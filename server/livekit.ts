import { AccessToken, IngressClient, IngressInput, RoomServiceClient } from "livekit-server-sdk";
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

function getIngressClient(): IngressClient {
  const url = ENV.livekitUrl.replace("wss://", "https://");
  return new IngressClient(url, ENV.livekitApiKey, ENV.livekitApiSecret);
}

export interface IngressDetails {
  ingressId: string;
  url: string;
  streamKey: string;
}

/**
 * Create a real LiveKit RTMP_INPUT ingress for a room.
 * Returns the LiveKit-issued URL and streamKey — never manually constructed.
 */
export async function createRtmpIngress(
  roomName: string,
  participantIdentity: string,
  participantName: string,
): Promise<IngressDetails> {
  const client = getIngressClient();
  const info = await client.createIngress(IngressInput.RTMP_INPUT, {
    name: `stream-${roomName}`,
    roomName,
    participantIdentity,
    participantName,
  });

  console.log('[LiveKit Ingress] Created ingress:', {
    ingressId: info.ingressId,
    url: info.url,
    streamKey: info.streamKey,
    roomName: info.roomName,
    participantIdentity: info.participantIdentity,
    status: info.state?.status,
  });

  if (!info.url || !info.streamKey) {
    throw new Error(`[LiveKit Ingress] Missing url or streamKey in response: ${JSON.stringify(info)}`);
  }

  return {
    ingressId: info.ingressId,
    url: info.url,
    streamKey: info.streamKey,
  };
}

/**
 * Delete a LiveKit ingress by ID (used when regenerating stream key).
 */
export async function deleteIngress(ingressId: string): Promise<void> {
  try {
    const client = getIngressClient();
    await client.deleteIngress(ingressId);
    console.log('[LiveKit Ingress] Deleted ingress:', ingressId);
  } catch (err) {
    console.warn('[LiveKit Ingress] Delete failed (may already be gone):', ingressId, err);
  }
}

/**
 * Get the current status of a LiveKit ingress.
 * Returns 'ENDPOINT_INACTIVE' | 'ENDPOINT_BUFFERING' | 'ACTIVE' | 'RECONNECTING' | 'OFFLINE' | 'unknown'
 */
export async function getIngressStatus(ingressId: string): Promise<string> {
  try {
    const client = getIngressClient();
    const list = await client.listIngress({ ingressId });
    if (!list || list.length === 0) return 'NOT_FOUND';
    const info = list[0];
    const statusNum = info.state?.status;
    // Map numeric status to string
    const statusMap: Record<number, string> = {
      0: 'ENDPOINT_INACTIVE',
      1: 'ENDPOINT_BUFFERING',
      2: 'ACTIVE',
      3: 'RECONNECTING',
      4: 'OFFLINE',
    };
    const statusStr = typeof statusNum === 'number' ? (statusMap[statusNum] ?? `UNKNOWN_${statusNum}`) : 'UNKNOWN';
    console.log('[LiveKit Ingress] Status check:', { ingressId, status: statusStr, rawStatus: statusNum });
    return statusStr;
  } catch (err) {
    console.error('[LiveKit Ingress] Status check failed:', ingressId, err);
    return 'ERROR';
  }
}
