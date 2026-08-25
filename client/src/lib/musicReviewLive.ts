export type RoomConnectionState = "connected" | "connecting" | "disconnected" | "reconnecting" | "failed" | "closed";

const TERMINAL_ROOM_STATES = new Set<RoomConnectionState>(["disconnected", "failed", "closed"]);

export function shouldEndJudgeBroadcast(connectionState: RoomConnectionState): boolean {
  return TERMINAL_ROOM_STATES.has(connectionState);
}

export function shouldShowViewerCount(isLive: boolean, viewerCountVisible: boolean): boolean {
  return isLive && viewerCountVisible;
}

export function shouldEnableMixedRadioAudio({
  isAdmin,
  hasRadioTrack,
  hasJudgeMic,
}: {
  isAdmin: boolean;
  hasRadioTrack: boolean;
  hasJudgeMic: boolean;
}): boolean {
  return !isAdmin && hasRadioTrack && hasJudgeMic;
}
