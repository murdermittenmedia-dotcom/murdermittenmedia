export type PickedNotification = {
  type: "picked";
  message: string;
  timestamp: number;
};

export function createPickedNotification(picked: boolean, timestamp = Date.now()): PickedNotification {
  return {
    type: "picked",
    message: picked ? "You've been picked to compete next!" : "You're up after the current battle!",
    timestamp,
  };
}
