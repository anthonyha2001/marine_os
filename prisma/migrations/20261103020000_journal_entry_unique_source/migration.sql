-- One journal entry per document, so a document can never be posted twice.
-- Partial index (Prisma's schema can't express it): reversals can repeat a sourceId, and a payroll
-- run may be paid again after "Undo payment" (its first entry is then reversed).
CREATE UNIQUE INDEX "JournalEntry_source_once"
  ON "JournalEntry" ("sourceType", "sourceId")
  WHERE "sourceType" NOT IN ('REVERSAL', 'PAYROLL') AND "sourceId" IS NOT NULL;
