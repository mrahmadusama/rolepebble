import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addNote,
  deleteNote,
  leaveOutUnit,
  listVersions,
  loadVersion,
  putBackTrimmed,
  restoreVersion,
  saveUnit,
  sendMessage,
  setApplicationTheme,
  startRegenerating,
  undoMessage,
  updateNote,
} from "@/app/(app)/applications/[id]/actions";
import { GET as downloadHeldPdf } from "@/app/api/pdf/[id]/route";
import { GET as downloadPdf } from "@/app/api/pdf/route";
import { ChatRole, DocumentKind, VersionCause } from "@/generated/prisma/enums";
import { deleteApplication, setArchived } from "@/lib/application-actions";
import { loadApplication } from "@/lib/application-documents";
import { loadApplicationRows } from "@/lib/applications-data";
import { loadDashboard } from "@/lib/dashboard-data";
import { runAsUser } from "@/lib/db";
import { OWNER_ID } from "@/lib/db/owner";
import { scopedDb } from "@/lib/db/scoped";
import { holdPdf } from "@/lib/pdf/downloads";
import { setStatus, undoStatus } from "@/lib/status-actions";
import { applyStatusChange } from "@/lib/status-changes";
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
let ids: { application: string; note: string; theme: string; job: string; version: string; message: string };

const SUMMARY = { id: "summary", label: "Summary", text: "Product designer" };
const LEFT_OUT = [{ kind: "unit" as const, unit: { id: "projects", label: "Projects", text: "Ledger app" }, index: 1 }];

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
      documents: { create: [{ kind: DocumentKind.RESUME, units: [SUMMARY], trimmed: LEFT_OUT }] },
      messages: {
        create: [
          {
            role: ChatRole.AI,
            text: "Tightened the summary.",
            edits: [{ document: DocumentKind.RESUME, unitId: "summary", text: SUMMARY.text, previousText: "Designer" }],
          },
        ],
      },
    },
    include: { notes: true, documents: true, messages: true },
  });
  const version = await owner.documentVersion.create({
    data: { documentId: application.documents[0].id, units: [{ ...SUMMARY, text: "Designer" }], cause: VersionCause.WRITTEN },
  });
  const theme = await owner.theme.create({ data: { name: "Mine", headFont: "NEWSREADER", bodyFont: "GEIST", accent: "#7a3b2e" } });
  const job = await owner.job.create({ data: { type: "write-documents", applicationId: application.id, input: {} } });
  ids = {
    application: application.id,
    note: application.notes[0].id,
    theme: theme.id,
    job: job.id,
    version: version.id,
    message: application.messages[0].id,
  };
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

  it("changes nothing of the owner's documents, chat or versions", async () => {
    signedIn.userId = other;
    const resume = { id: ids.application, document: DocumentKind.RESUME, unitId: "summary" };
    expect(await saveUnit({ ...resume, text: "Taken", expected: SUMMARY.text })).toMatchObject({ ok: false });
    expect(await startRegenerating(resume)).toMatchObject({ ok: false });
    expect(await leaveOutUnit({ id: ids.application, unitId: "summary" })).toMatchObject({ ok: false });
    expect(await putBackTrimmed({ id: ids.application, index: 0 })).toMatchObject({ ok: false });
    expect(await sendMessage({ id: ids.application, text: "Make it shorter", viewing: DocumentKind.RESUME, target: null })).toMatchObject({ ok: false });
    expect(await undoMessage({ id: ids.application, messageId: ids.message })).toMatchObject({ ok: false });
    expect(await listVersions({ id: ids.application, document: DocumentKind.RESUME })).toEqual({ ok: true, data: [] });
    expect(await loadVersion({ id: ids.application, versionId: ids.version })).toMatchObject({ ok: false });
    expect(await restoreVersion({ id: ids.application, versionId: ids.version })).toMatchObject({ ok: false });

    const document = await prisma().document.findFirstOrThrow({ where: { applicationId: ids.application } });
    expect(document).toMatchObject({ units: [SUMMARY], trimmed: LEFT_OUT });
    expect(await prisma().documentVersion.count({ where: { documentId: document.id } })).toBe(1);
    expect(await prisma().chatMessage.findMany({ where: { applicationId: ids.application } })).toMatchObject([{ id: ids.message, undone: false }]);
    // No AI work was started on the owner's application.
    expect(await prisma().job.count()).toBe(1);
  });

  it("can't undo the owner's status change", async () => {
    const change = await applyStatusChange(scopedDb(OWNER_ID, prisma()), ids.application, "SENT");
    if (change.outcome !== "changed") throw new Error("expected a change");

    signedIn.userId = other;
    expect(await undoStatus({ eventId: change.event.id })).toMatchObject({ ok: false });
    expect(await prisma().application.findUniqueOrThrow({ where: { id: ids.application } })).toMatchObject({ status: "SENT" });
    expect(await prisma().statusEvent.count({ where: { id: change.event.id } })).toBe(1);
  });

  it("can't fetch a PDF held for the owner", async () => {
    const held = holdPdf(new Uint8Array([37, 80, 68, 70]), "Jane Doe.pdf", OWNER_ID);
    const fetchAs = async (userId: string) => {
      signedIn.userId = userId;
      return downloadHeldPdf(new NextRequest(`http://localhost/api/pdf/${held}`), { params: Promise.resolve({ id: held }) });
    };
    expect((await fetchAs(other)).status).toBe(404);
    expect((await fetchAs(OWNER_ID)).status).toBe(200);
  });

  it("can't download the owner's documents, and nothing is printed for them", async () => {
    signedIn.userId = other;
    const response = await downloadPdf(new NextRequest(`http://localhost/api/pdf?doc=resume&application=${ids.application}`), {});
    expect(response.status).toBe(404);
    expect(render.renderPdf).not.toHaveBeenCalled();
  });
});
