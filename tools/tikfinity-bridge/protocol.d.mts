export type BridgeAuthentication = { bridgeId: string; secret: string };
export function assertNodeSupported(version?: string): void;
export function validateServerUrl(value: string): string;
export function signExactBody(secret: string, timestamp: string, nonce: string, exactBody: string): string;
export function signedRequest(config: BridgeAuthentication, body: unknown, timestamp?: string, nonce?: string): { exactBody: string; headers: Record<string, string> };
export class HttpError extends Error { status: number; constructor(status: number); }
export function readBoundedJson(response: Response): Promise<unknown>;
export function postJson(serverUrl: string, path: string, body: unknown, auth?: BridgeAuthentication): Promise<unknown>;
export function retryDelay(attempt: number, random?: () => number): number;
