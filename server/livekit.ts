import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { ENV } from "./_core/env";
import { randomBytes } from "crypto";

function getClient(): RoomServiceClient {
  const url = ENV.livekitUrl.replace("wss://", "https://");
  return new RoomServiceClient(url, ENV.livekitApiKey, ENV.livekitApiSecret);
}

/** Generate a unique LiveKit room name */
export function generateRoomName(userId: number): string {
  const rand = randomBytes(4).toString("hex");
  return `cookup-${userId}-${rand}`;
}

/** Generate a streamer token (can publish video/audio) */
export async function generateStreamerToken(roomName: string, identity: string, displayName: string): Promise<string> {
  const token = new AccessToken(ENV.livekitApiKey, ENV.livekitApiSecret, {
    identity,
    name: displayName,
    ttl: "8h",
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return token.toJwt();
}

/** Generate a viewer token (subscribe only) */
export async function generateViewerToken(roomName: string, identity: string, displayName: string): Promise<string> {
  const token = new AccessToken(ENV.livekitApiKey, ENV.livekitApiSecret, {
    identity,
    name: displayName,
    ttl: "4h",
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: false,
    canSubscribe: true,
    canPublishData: true, // allow sending chat data messages
  });
  return token.toJwt();
}

/** Delete a LiveKit room (ends the stream for all participants) */
export async function deleteRoom(roomName: string): Promise<void> {
  try {
    const client = getClient();
    await client.deleteRoom(roomName);
  } catch {
    // Room may already be empty/deleted
  }
}

/** Get participant count for a room */
export async function getRoomParticipantCount(roomName: string): Promise<number> {
  try {
    const client = getClient();
    const participants = await client.listParticipants(roomName);
    return participants.length;
  } catch {
    return 0;
  }
}
