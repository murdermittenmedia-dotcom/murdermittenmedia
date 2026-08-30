export type ActivityBroadcastPayload = {
  id: number;
  type: string;
  message: string;
  metadata: string | null;
  createdAt: Date;
};

type ActivityBroadcaster = (event: ActivityBroadcastPayload) => void;

let broadcaster: ActivityBroadcaster | null = null;

export function setActivityBroadcaster(next: ActivityBroadcaster) {
  broadcaster = next;
}

export function broadcastActivityEvent(event: ActivityBroadcastPayload) {
  broadcaster?.(event);
}

export function resetActivityBroadcasterForTests() {
  broadcaster = null;
}
