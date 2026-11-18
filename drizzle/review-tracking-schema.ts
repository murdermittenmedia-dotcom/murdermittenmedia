import { bigint, int, mysqlTable, varchar } from "drizzle-orm/mysql-core";

/** Recovery credentials only; the existing review queue remains authoritative.
 * No parent-schema import: this module is safe to re-export from schema.ts.
 * Issuing another link replaces the hash and revokes the previous link. */
export const reviewSubmissionRecoveryTokens = mysqlTable(
  "review_submission_recovery_tokens",
  {
    submissionId: int("submissionId").primaryKey(),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
    updatedAtMs: bigint("updatedAtMs", { mode: "number" }).notNull(),
  }
);

export type ReviewSubmissionRecoveryToken =
  typeof reviewSubmissionRecoveryTokens.$inferSelect;
