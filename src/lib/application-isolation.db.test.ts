import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { addNote, deleteNote, setApplicationTheme, updateNote } from "@/app/(app)/applications/[id]/actions";
import { GET as downloadPdf } from "@/app/api/pdf/route";
import { deleteApplication, setArchived } from "@/lib/application-actions";
import { loadApplication } from "@/lib/application-documents";
import { loadApplicationRows } from "@/lib/applications-data";
import { loadDashboard } from "@/lib/dashboard-data";
import { runAsUser } from "@/lib/db";
import { OWNER_ID } from "@/lib/db/owner";
import { scopedDb } from "@/lib/db/scoped";
import { setStatus } from "@/lib/status-actions";
import { createTestClient, createTestUser, resetDatabase } from "@/test/db";

import { seedBuiltIns } from "../../prisma/seed/built-ins";

// Phase 2, step 4: one user's applications, with their documents, notes,
// status history and PDFs, stay theirs. The owner has an application; a
// second user, signed in, must see none of it and change none of it.

const db = vi.hoisted(() => ({ client: undefined as ReturnType<typeof createTestClient> | undefined }));
vi.mock("@/lib/prisma", async () => {
  const { createTestClient } = await import("@/test/db");
  db.client = createTestClient();
  return { prisma: db.client };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
// The PDF route must answer before printing anything; nothing may be printed.
const render = vi.hoisted(() => ({ renderPdf: vi.fn(async () => new Uint8Array([37, 80, 68, 70])) }));
vi.mock("@/lib/pdf/render", () => render);
// Deleting an application cancels its jobs, by application id alone.
const runner = vi.hoisted(() => ({ cancelApplicationJobs: vi.fn(async () => {}) }));
vi.mock("@/lib/jobs/runner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/jobs/runner")>()),
  cancelApplicationJobs: runner.cancelApplicationJobs,
}));
// Whose session it is: sign-in only knows the owner until Phase 2's PR 10.
const signedIn = vi.hoisted(() => ({ userId: "owner" }));
vi.mock("@/lib/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/context")>()),
  sessionUserId: () => signedIn.userId,
}));

const prisma = () => db.client!;
let other: string;
let ids: { application: string; note: string; theme: string; job: string };

beforeEach(async () => {
  await resetDatabase(prisma());
  await seedBuiltIns(prisma());
  other = await createTestUser(prisma());
  signedIn.userId = OWNER_ID;
  render.renderPdf.mockClear();
  runner.cancelApplicationJobs.mockClear();

  const owner = scopedDb(OWNER_ID, prisma());
  const application = await owner.application.create({
    data: {
      company: "Ledgerly",
      role: "Product Designer",
      notes: { create: [{ body: "Call back Monday" }] },
      documents: { create: [{ kind: "RESUME", units: [] }] },
    },
    include: { notes: true },
  });
  const theme = await owner.theme.create({ data: { name: "Mine", headFont: "NEWSREADER", bodyFont: "GEIST", accent: "#7a3b2e" } });
  const job = await owner.job.create({ data: { type: "write-documents", applicationId: application.id, input: {} } });
  ids = { application: application.id, note: application.notes[0].id, theme: theme.id, job: job.id };
});
afterAll(() => prisma().$disconnect());

describe("another user's applications", () => {
  it("lists, shows and counts none of the owner's", async () => {
    await runAsUser(other, async () => {
      expect(await loadApplicationRows({ archived: false, sort: { key: "updated", reversed: false } })).toEqual([]);
      expect((await loadDashboard()).total).toBe(0);
      await expect(loadApplication(ids.application)).rejects.toThrow("NOT_FOUND");
    });
    await runAsUser(OWNER_ID, async () => {
      expect((await loadApplicationRows({ archived: false, sort: { key: "updated", reversed: false } })).map((row) => row.company)).toEqual(["Ledgerly"]);
    });
  });

  it("changes nothing of the owner's application through its actions", async () => {
    signedIn.userId = other;
    const gone = { ok: false, error: "That application no longer exists." };
    expect(await setArchived({ id: ids.application, archived: true })).toEqual(gone);
    expect(await setStatus({ id: ids.application, to: "SENT" })).toEqual(gone);
    expect(await addNote({ id: ids.application, body: "Taken" })).toEqual(gone);
    expect(await updateNote({ id: ids.application, noteId: ids.note, body: "Taken" })).toMatchObject({ ok: false });
    expect(await deleteNote({ id: ids.application, noteId: ids.note })).toMatchObject({ ok: false });
    expect(await setApplicationTheme({ id: ids.application, themeId: ids.theme })).toMatchObject({ ok: false });
    expect(await deleteApplication({ id: ids.application })).toEqual(gone);

    const application = await prisma().application.findUniqueOrThrow({ where: { id: ids.application }, include: { notes: true } });
    expect(application).toMatchObject({ archivedAt: null, status: "DRAFT", userId: OWNER_ID });
    expect(application.notes.map((note) => note.body)).toEqual(["Call back Monday"]);
    // Deleting someone else's application didn't cancel its work either.
    expect(runner.cancelApplicationJobs).not.toHaveBeenCalled();
    expect(await prisma().job.findUniqueOrThrow({ where: { id: ids.job } })).toMatchObject({ status: "QUEUED" });
  });

  it("can't download the owner's documents, and nothing is printed for them", async () => {
    signedIn.userId = other;
    const response = await downloadPdf(new NextRequest(`http://localhost/api/pdf?doc=resume&application=${ids.application}`), {});
    expect(response.status).toBe(404);
    expect(render.renderPdf).not.toHaveBeenCalled();
  });
});
