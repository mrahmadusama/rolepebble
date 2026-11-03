import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { DocumentKind } from "@/generated/prisma/enums";
import { unitsSchema, type Unit } from "@/lib/application-data";
import { saveVersion, type VersionNote } from "@/lib/document-versions";
import { userDb } from "@/lib/db";

// Changes to a tailored document's units: an edit by hand (E8-3), a
// regenerated unit (E8-4), the refine chat's edits and their undo (E8-5,
// E8-6). They can overlap, since AI work runs in the background, so every
// change reads, edits and writes in one go, and starts over if a document
// changed in between. Nothing is overwritten unseen.

/** An application's documents by kind; a missing document is absent. */
export type DocumentUnits = Partial<Record<DocumentKind, Unit[]>>;

class ChangedMeanwhile extends Error {}

const ATTEMPTS = 3;

/**
 * Lets `change` edit the application's units (in place) and make other
 * writes with `tx`, then saves the documents whose units changed, all in one
 * transaction. With `version`, each changed document also gets a version
 * (E8-10): AI changes pass one, edits by hand don't. Returns what `change`
 * returns.
 */
export async function updateDocuments<T>(
  applicationId: string,
  change: (documents: DocumentUnits, tx: Prisma.TransactionClient) => Promise<T>,
  { version }: { version?: VersionNote } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await (await userDb()).$userTransaction(async (tx) => {
        const rows = await tx.document.findMany({ where: { applicationId } });
        const documents: DocumentUnits = {};
        for (const row of rows) documents[row.kind] = unitsSchema.parse(row.units);
        const before = new Map(rows.map((row) => [row.kind, JSON.stringify(documents[row.kind])]));

        const result = await change(documents, tx);

        for (const row of rows) {
          const units = unitsSchema.parse(documents[row.kind]);
          if (JSON.stringify(units) === before.get(row.kind)) continue;
          // Only if nobody else saved it since it was read.
          const { count } = await tx.document.updateMany({
            where: { id: row.id, updatedAt: row.updatedAt },
            data: { units },
          });
          if (count === 0) throw new ChangedMeanwhile();
          if (version) await saveVersion(tx, row.id, units, version);
        }
        return result;
      });
    } catch (error) {
      if (!(error instanceof ChangedMeanwhile) || attempt === ATTEMPTS) throw error;
    }
  }
}
