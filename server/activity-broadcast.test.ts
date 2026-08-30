import { afterEach, describe, expect, it, vi } from "vitest";
import {
  broadcastActivityEvent,
  resetActivityBroadcasterForTests,
  setActivityBroadcaster,
} from "./activity";

describe("activity event broadcaster", () => {
  afterEach(() => resetActivityBroadcasterForTests());

  it("forwards persisted events to the configured Socket.io bridge", () => {
    const listener = vi.fn();
    setActivityBroadcaster(listener);
    const event = {
      id: 42,
      type: "review",
      message: "Music Review is live",
      metadata: '{"href":"/review"}',
      createdAt: new Date("2026-08-30T06:20:00.000Z"),
    };

    broadcastActivityEvent(event);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(event);
  });

  it("does nothing when the server bridge has not been initialized", () => {
    expect(() => broadcastActivityEvent({
      id: 1,
      type: "community",
      message: "New forum post",
      metadata: null,
      createdAt: new Date(),
    })).not.toThrow();
  });
});
