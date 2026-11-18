/** V2 shares the standalone Node runtime implementation; V1 is intentionally unchanged.
 * Compatibility is documentation-based, not observed TikFinity LIVE verification.
 */
export {
  DEFAULT_COMMANDS, EVENT_TYPES, NormalizationError, normalizeTikFinityReviewEventV2,
  stableIdDiagnostics, isConfiguredGalaxy, validateCommands,
} from '../tools/tikfinity-bridge/normalize.mjs';
export type { TikFinityReviewEventV2, ReviewBridgeCommands, ReviewBridgeReceiptContext } from '../tools/tikfinity-bridge/normalize.mjs';
import type { TikFinityReviewEventV2, ReviewBridgeCommands } from '../tools/tikfinity-bridge/normalize.mjs';
export type ReviewBridgePairRequest = { pairingCode: string; deviceLabel: string };
export type ReviewBridgePairResponse = { bridgeId: string; secret: string };
export type ReviewBridgeHeartbeatRequest = { localConnected: boolean; testMode: boolean; roomId?: string };
export type ReviewBridgeHeartbeatResponse = {
  streamId: string; roomId: string; occurrenceId: string | null;
  commands: ReviewBridgeCommands; enabled: boolean; galaxyGiftId: string | null;
  /** Required true by simulator as explicit server-side isolated-test acknowledgement. */
  testMode?: boolean;
};
export type ReviewBridgeEventReceipt = { receiptId: string; receivedAtMs: number; event: TikFinityReviewEventV2 };
export type ReviewBridgeEventsRequest = { streamId: string; events: ReviewBridgeEventReceipt[]; testMode: boolean };
