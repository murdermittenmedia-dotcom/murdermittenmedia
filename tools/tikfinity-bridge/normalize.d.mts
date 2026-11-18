export type TikFinityReviewEventV2 = {
  kind: 'chat' | 'gift' | 'follow' | 'like' | 'share' | 'subscribe' | 'roomUser';
  roomId: string; messageId: string; userId: string; occurrenceId: string | null;
  handle?: string; displayName?: string; comment?: string; giftId?: string; giftName?: string; giftType?: number;
  repeatCount?: number; repeatEnd?: boolean; streakId?: string;
  likeCount?: number; totalLikeCount?: number; viewerCount?: number;
};
export type ReviewBridgeCommands = { fire: string; trash: string; link: string };
export type ReviewBridgeReceiptContext = { streamId: string; roomId: string; occurrenceId: string | null; commands?: ReviewBridgeCommands };
export const DEFAULT_COMMANDS: Readonly<ReviewBridgeCommands>;
export const EVENT_TYPES: readonly TikFinityReviewEventV2['kind'][];
export class NormalizationError extends Error { code: string; constructor(code: string); }
export function validateCommands(commands?: ReviewBridgeCommands): ReviewBridgeCommands;
export function normalizeTikFinityReviewEventV2(message: unknown, context: ReviewBridgeReceiptContext): TikFinityReviewEventV2 | null;
export function stableIdDiagnostics(message: unknown): { eventType: string; messageIdPresent: boolean; userIdPresent: boolean; roomIdPresent: boolean; handlePresent: boolean; giftIdPresent: boolean; streakIdPresent: boolean };
export function isConfiguredGalaxy(event: TikFinityReviewEventV2, galaxyGiftId: string | null): boolean;
