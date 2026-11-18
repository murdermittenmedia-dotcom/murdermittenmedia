import { bigint, boolean, int, mysqlTable, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

// Private connector records: no secrets or provider IDs appear in public queue/overlay responses.
export const reviewBridgeDevices = mysqlTable("review_bridge_devices", {
  id: varchar("id", { length: 36 }).primaryKey(),
  pairingHash: varchar("pairingHash", { length: 64 }),
  pairingExpiresAtMs: bigint("pairingExpiresAtMs", { mode: "number" }),
  credentialCiphertext: text("credentialCiphertext"),
  deviceLabel: varchar("deviceLabel", { length: 80 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  testMode: boolean("testMode").default(false).notNull(),
  streamId: varchar("streamId", { length: 36 }).notNull(),
  roomId: varchar("roomId", { length: 30 }).notNull(),
  fireCommand: varchar("fireCommand", { length: 32 }).default("!fire").notNull(),
  trashCommand: varchar("trashCommand", { length: 32 }).default("!trash").notNull(),
  galaxyGiftId: varchar("galaxyGiftId", { length: 64 }),
  localConnected: boolean("localConnected").default(false).notNull(),
  lastHeartbeatMs: bigint("lastHeartbeatMs", { mode: "number" }),
  lastLiveEventMs: bigint("lastLiveEventMs", { mode: "number" }),
  lastTestEventMs: bigint("lastTestEventMs", { mode: "number" }),
  createdAtMs: bigint("createdAtMs", { mode: "number" }).notNull(),
  createdByUserId: int("createdByUserId").notNull(),
});
export const reviewBridgeReceipts = mysqlTable("review_bridge_receipts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  bridgeId: varchar("bridgeId", { length: 36 }).notNull(),
  streamId: varchar("streamId", { length: 36 }).notNull(),
  eventKind: varchar("eventKind", { length: 16 }).notNull(),
  actor: varchar("actor", { length: 128 }),
  giftId: varchar("giftId", { length: 64 }),
  giftName: varchar("giftName", { length: 100 }),
  outcome: varchar("outcome", { length: 100 }).notNull(),
  testMode: boolean("testMode").default(false).notNull(),
  timestampMs: bigint("timestampMs", { mode: "number" }).notNull(),
});
export const reviewBridgeNonces = mysqlTable("review_bridge_nonces", {
  id: varchar("id", { length: 64 }).primaryKey(),
  timestampMs: bigint("timestampMs", { mode: "number" }).notNull(),
});
export const reviewTikTokLinkCodes = mysqlTable("review_tiktok_link_codes", {
  codeHash: varchar("codeHash", { length: 64 }).primaryKey(),
  submissionId: int("submissionId").notNull(),
  streamId: varchar("streamId", { length: 36 }).notNull(),
  expiresAtMs: bigint("expiresAtMs", { mode: "number" }).notNull(),
  consumedAtMs: bigint("consumedAtMs", { mode: "number" }),
});
export const reviewTikTokSubmissionLinks = mysqlTable("review_tiktok_submission_links", {
  submissionId: int("submissionId").primaryKey(),
  streamId: varchar("streamId", { length: 36 }).notNull(),
  platformUserId: varchar("platformUserId", { length: 128 }).notNull(),
  actor: varchar("actor", { length: 128 }).notNull(),
  linkedAtMs: bigint("linkedAtMs", { mode: "number" }).notNull(),
});
export const reviewGalaxyRedemptions = mysqlTable("review_galaxy_redemptions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  bridgeId: varchar("bridgeId", { length: 36 }).notNull(),
  streamId: varchar("streamId", { length: 36 }).notNull(),
  providerUserId: varchar("providerUserId", { length: 128 }).notNull(),
  actor: varchar("actor", { length: 128 }).notNull(),
  giftId: varchar("giftId", { length: 64 }).notNull(),
  unit: int("unit").notNull(),
  submissionId: int("submissionId"),
  status: varchar("status", { length: 32 }).default("awaiting_admin").notNull(),
  receivedAtMs: bigint("receivedAtMs", { mode: "number" }).notNull(),
  redeemedAtMs: bigint("redeemedAtMs", { mode: "number" }),
  reviewedByUserId: int("reviewedByUserId"),
  auditNote: varchar("auditNote", { length: 500 }),
}, (table) => [uniqueIndex("review_galaxy_stream_submission").on(table.streamId, table.submissionId)]);
