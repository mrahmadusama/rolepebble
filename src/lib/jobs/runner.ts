import "server-only";

import type { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { JobStatus } from "@/generated/prisma/enums";
import { AiError } from "@/lib/ai/errors";
import { runAsUser, userDb } from "@/lib/db";
import { logServerError } from "@/lib/log";
import { prisma } from "@/lib/prisma";

// Long AI tasks run as background jobs (E6-7): the request that starts one
// returns at once with its id, the work goes on in this process, and the
// page follows its named steps (/api/jobs/[id]/events). Progress lives in
// the Job table, so a reloaded page can pick the job up again. Dossier runs
// as a single instance, so an in-process queue is enough.
//
// Every job is its user's (Phase 2): it's created, read, retried and
// cancelled through their client, and runs as them. The queue itself works
// on every user's jobs, by id, with the system client; it takes turns, so
// one person's jobs never hold up everyone else's.

export type JobContext = {
  /** The job's own id, e.g. to link it to the application it makes. */
  id: string;
  /** Names the step now in progress, e.g. "Reading the posting". */
  step: (name: string) => Promise<void>;
  /** Aborts when the job is cancelled; pass it on to AI calls. */
  signal: AbortSignal;
};

export type JobDefinition<I, R> = {
  type: string;
  input: z.ZodType<I>;
  result: z.ZodType<R>;
  /**
   * Does the work. It may run again on Retry with the same input, so it must
   * write its data idempotently (upsert, or replace in one transaction).
   */
  run: (input: I, context: JobContext) => Promise<R>;
};

/** What a page learns about a job. */
export type JobView<R = unknown> = {
  id: string;
  type: string;
  status: JobStatus;
  step: string | null;
  error: string | null;
  result: R | null;
};

export const JOB_MESSAGES = {
  failed: "Something went wrong while working on this. Try again.",
  interrupted: "RolePebble restarted before this finished. Try again.",
  cancelled: "Cancelled.",
} as const;

/** Jobs running at once, for everyone together. */
const MAX_RUNNING = 3;
/** Jobs running at once for one user: a fair share, and one request at a time suits local models (PRD §11). */
const MAX_RUNNING_PER_USER = 1;

type Listener = (job: JobView) => void;

type RunnerState = {
  definitions: Map<string, JobDefinition<unknown, unknown>>;
  /** Waiting jobs, oldest first, with whose they are. */
  queue: { id: string; userId: string }[];
  running: Map<string, { controller: AbortController; userId: string }>;
  listeners: Map<string, Set<Listener>>;
};

// On globalThis, so the dev server's hot reloads keep one queue.
const globalForJobs = globalThis as unknown as { jobRunner?: RunnerState };
const state: RunnerState = (globalForJobs.jobRunner ??= {
  definitions: new Map(),
  queue: [],
  running: new Map(),
  listeners: new Map(),
});

/** Registers a job type; call at module level where the job is defined. */
export function defineJob<I, R>(definition: JobDefinition<I, R>): JobDefinition<I, R> {
  state.definitions.set(definition.type, definition as JobDefinition<unknown, unknown>);
  return definition;
}

const VIEW_FIELDS = { id: true, type: true, status: true, step: true, error: true, result: true } as const;

/** One of the current user's jobs, or null when there's none of theirs with that id. */
export async function getJob(id: string): Promise<JobView | null> {
  return (await userDb()).job.findUnique({ where: { id }, select: VIEW_FIELDS });
}

/** A job whoever's it is, for the queue's own listeners. */
const readJob = (id: string): Promise<JobView | null> => prisma.job.findUnique({ where: { id }, select: VIEW_FIELDS });

/** The newest job for something on screen, e.g. "application:<id>", to reattach after a reload. */
export async function findLatestJob(key: string): Promise<JobView | null> {
  return (await userDb()).job.findFirst({ where: { key }, orderBy: { createdAt: "desc" }, select: VIEW_FIELDS });
}

/** Jobs for something on screen that are still queued or running, oldest first, with their input. */
export async function findUnfinishedJobs(key: string): Promise<{ id: string; type: string; input: unknown }[]> {
  return (await userDb()).job.findMany({
    where: { key, status: { in: [JobStatus.QUEUED, JobStatus.RUNNING] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, input: true },
  });
}

export function isFinished(job: Pick<JobView, "status">): boolean {
  return job.status === JobStatus.DONE || job.status === JobStatus.FAILED;
}

/**
 * Queues a job for the current user and returns its id right away. A job
 * that works on an application names it, so deleting the application deletes
 * the job too.
 */
export async function startJob<I, R>(
  definition: JobDefinition<I, R>,
  input: NoInfer<I>,
  options: { key?: string; applicationId?: string } = {},
): Promise<string> {
  defineJob(definition);
  const db = await userDb();
  const job = await db.job.create({
    data: {
      type: definition.type,
      key: options.key,
      applicationId: options.applicationId,
      input: definition.input.parse(input) as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  enqueue(job.id, db.$userId);
  return job.id;
}

/** Runs one of the current user's failed jobs again, as the same job with the same input. */
export async function retryJob(id: string): Promise<boolean> {
  const db = await userDb();
  const { count } = await db.job.updateMany({
    where: { id, status: JobStatus.FAILED },
    data: { status: JobStatus.QUEUED, step: null, error: null, result: Prisma.DbNull, startedAt: null, finishedAt: null },
  });
  if (count === 0) return false;
  await notify(id);
  enqueue(id, db.$userId);
  return true;
}

/** Stops one of the current user's queued or running jobs; it ends as failed with "Cancelled.". */
export async function cancelJob(id: string): Promise<void> {
  if (!(await (await userDb()).job.count({ where: { id } }))) return;
  const queued = state.queue.findIndex((entry) => entry.id === id);
  if (queued >= 0) {
    state.queue.splice(queued, 1);
    await finish(id, { status: JobStatus.FAILED, error: JOB_MESSAGES.cancelled });
    return;
  }
  state.running.get(id)?.controller.abort();
}

/** Stops every queued or running job of the current user's that works on an application, e.g. before it's deleted. */
export async function cancelApplicationJobs(applicationId: string): Promise<void> {
  const unfinished = await (await userDb()).job.findMany({
    where: { applicationId, status: { in: [JobStatus.QUEUED, JobStatus.RUNNING] } },
    select: { id: true },
  });
  for (const job of unfinished) await cancelJob(job.id);
}

/** Calls `listener` with the job's state after every change; returns how to stop. */
export function subscribeJob(id: string, listener: Listener): () => void {
  const listeners = state.listeners.get(id) ?? new Set();
  listeners.add(listener);
  state.listeners.set(id, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) state.listeners.delete(id);
  };
}

async function notify(id: string): Promise<void> {
  const listeners = state.listeners.get(id);
  if (!listeners?.size) return;
  const job = await readJob(id);
  if (job) for (const listener of listeners) listener(job);
}

/** Records how a job ended; one deleted meanwhile (its application, a discarded import) just ends. */
async function finish(
  id: string,
  data: { status: JobStatus; result?: Prisma.InputJsonValue; error?: string },
): Promise<void> {
  const { count } = await prisma.job.updateMany({ where: { id }, data: { ...data, finishedAt: new Date() } });
  if (count > 0) await notify(id);
}

function enqueue(id: string, userId: string): void {
  if (!state.queue.some((entry) => entry.id === id)) state.queue.push({ id, userId });
  pump();
}

/** How many jobs `userId` has running now. */
const runningFor = (userId: string) => [...state.running.values()].filter((job) => job.userId === userId).length;

/** The oldest waiting job of a user below their share; others' jobs go ahead of a busy user's. */
const nextJob = () => state.queue.find((entry) => runningFor(entry.userId) < MAX_RUNNING_PER_USER);

/** Starts waiting jobs while there's room. */
function pump(): void {
  for (let next = nextJob(); next && state.running.size < MAX_RUNNING; next = nextJob()) {
    const { id, userId } = next;
    state.queue.splice(state.queue.indexOf(next), 1);
    const controller = new AbortController();
    state.running.set(id, { controller, userId });
    void execute(id, controller).finally(() => {
      state.running.delete(id);
      pump();
    });
  }
}

async function execute(id: string, controller: AbortController): Promise<void> {
  try {
    const job = await prisma.job.update({
      where: { id },
      data: { status: JobStatus.RUNNING, startedAt: new Date() },
      select: { type: true, input: true, userId: true },
    });
    await notify(id);
    // Job types register when their module loads; make sure they all have.
    await import("./definitions");
    const definition = state.definitions.get(job.type);
    if (!definition) throw new Error(`No job type "${job.type}" is defined.`);

    // A job works on its owner's data, whoever's request started the queue.
    const result = await runAsUser(job.userId, () => definition.run(definition.input.parse(job.input), {
      id,
      signal: controller.signal,
      step: async (name) => {
        // Deleted meanwhile: there's no one left to do it for.
        const { count } = await prisma.job.updateMany({ where: { id }, data: { step: name } });
        if (count === 0) controller.abort();
        else await notify(id);
      },
    }));
    await finish(id, { status: JobStatus.DONE, result: definition.result.parse(result) as Prisma.InputJsonValue });
  } catch (error) {
    // AI failures already say what to do; anything else is logged and kept vague.
    const message = controller.signal.aborted
      ? JOB_MESSAGES.cancelled
      : error instanceof AiError
        ? error.message
        : JOB_MESSAGES.failed;
    if (!(error instanceof AiError) && !controller.signal.aborted) logServerError(`job ${id}`, error);
    await finish(id, { status: JobStatus.FAILED, error: message }).catch((cause: unknown) => logServerError(`job ${id}`, cause));
  }
}

/**
 * Called once at startup, for every user: jobs a previous process left
 * queued or running can't finish, so they're marked failed and the page
 * offers Retry.
 */
export async function recoverInterruptedJobs(): Promise<number> {
  const { count } = await prisma.job.updateMany({
    where: { status: { in: [JobStatus.QUEUED, JobStatus.RUNNING] } },
    data: { status: JobStatus.FAILED, error: JOB_MESSAGES.interrupted, finishedAt: new Date() },
  });
  return count;
}
