import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { OWNER_ID } from "@/lib/db/owner";
import { scopedDb } from "@/lib/db/scoped";
import { createTestClient, createTestUser, resetDatabase } from "@/test/db";

import { applyStatusChange, undoStatusChange } from "./status-changes";

const db = createTestClient();
const owner = scopedDb(OWNER_ID, db);

beforeEach(() => resetDatabase(db));
afterAll(() => db.$disconnect());

const t = (minute: number) => new Date(Date.UTC(2026, 8, 27, 12, minute));

async function fields(id: string) {
  return db.application.findUniqueOrThrow({
    where: { id },
    select: { status: true, furthestStage: true, sentAt: true },
  });
}

describe("applyStatusChange", () => {
  it("updates the application and records the event in one go", async () => {
    const { id } = await db.application.create({ data: { company: "Ledgerly" } });
    const result = await applyStatusChange(owner, id, "SENT", t(0));

    expect(result).toMatchObject({
      outcome: "changed",
      event: { applicationId: id, from: "DRAFT", to: "SENT", at: t(0), previousFurthestStage: null, previousSentAt: null },
    });
    expect(await fields(id)).toEqual({ status: "SENT", furthestStage: "SENT", sentAt: t(0) });
  });

  it("records nothing when the status doesn't change", async () => {
    const { id } = await db.application.create({ data: {} });
    expect(await applyStatusChange(owner, id, "DRAFT", t(0))).toEqual({ outcome: "unchanged" });
    expect(await db.statusEvent.count()).toBe(0);
  });

  it("reports a missing application", async () => {
    expect(await applyStatusChange(owner, "missing", "SENT", t(0))).toEqual({ outcome: "not-found" });
  });

  it("applies concurrent changes one after the other", async () => {
    const { id } = await db.application.create({ data: {} });
    await Promise.all([
      applyStatusChange(owner, id, "SENT", t(0)),
      applyStatusChange(owner, id, "SCREENING", t(1)),
    ]);
    const events = await db.statusEvent.findMany({ orderBy: { at: "asc" } });
    // Whichever ran second saw the first one's result.
    expect(events).toHaveLength(2);
    expect(events[1].from).toBe(events[0].to);
    expect((await fields(id)).furthestStage).toBe("SCREENING");
  });
});

describe("undoStatusChange", () => {
  it("restores the previous status, stage and sent date, and deletes the event", async () => {
    const { id } = await db.application.create({ data: {} });
    await applyStatusChange(owner, id, "SCREENING", t(0));
    const accidental = await applyStatusChange(owner, id, "OFFER", t(1));
    if (accidental.outcome !== "changed") throw new Error("expected a change");

    expect(await undoStatusChange(owner, accidental.event.id)).toEqual({ outcome: "undone", status: "SCREENING" });
    expect(await fields(id)).toEqual({ status: "SCREENING", furthestStage: "SCREENING", sentAt: t(0) });
    expect(await db.statusEvent.count()).toBe(1);
  });

  it("undoes a first move out of Draft completely", async () => {
    const { id } = await db.application.create({ data: {} });
    const sent = await applyStatusChange(owner, id, "SENT", t(0));
    if (sent.outcome !== "changed") throw new Error("expected a change");

    await undoStatusChange(owner, sent.event.id);
    expect(await fields(id)).toEqual({ status: "DRAFT", furthestStage: null, sentAt: null });
  });

  it("only undoes the latest change", async () => {
    const { id } = await db.application.create({ data: {} });
    const first = await applyStatusChange(owner, id, "SENT", t(0));
    await applyStatusChange(owner, id, "INTERVIEW", t(1));
    if (first.outcome !== "changed") throw new Error("expected a change");

    expect(await undoStatusChange(owner, first.event.id)).toEqual({ outcome: "superseded" });
    expect((await fields(id)).status).toBe("INTERVIEW");
    expect(await undoStatusChange(owner, "missing")).toEqual({ outcome: "not-found" });
  });
});

describe("status changes for another user", () => {
  it("can't change or undo the status of someone else's application", async () => {
    const other = scopedDb(await createTestUser(db), db);
    const { id } = await db.application.create({ data: { company: "Ledgerly" } });
    expect(await applyStatusChange(other, id, "SENT", t(0))).toEqual({ outcome: "not-found" });

    const changed = await applyStatusChange(owner, id, "SENT", t(1));
    if (changed.outcome !== "changed") throw new Error("expected a change");
    expect(await undoStatusChange(other, changed.event.id)).toEqual({ outcome: "not-found" });
    expect(await fields(id)).toMatchObject({ status: "SENT" });
  });
});
