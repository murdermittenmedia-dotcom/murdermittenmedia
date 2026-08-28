import { describe, expect, it } from "vitest";
import { createPickedNotification } from "@shared/picked-notification";

describe("picked battle notifications", () => {
  it("creates the picked message with a stable timestamp", () => {
    expect(createPickedNotification(true, 123)).toEqual({
      type: "picked",
      message: "You've been picked to compete next!",
      timestamp: 123,
    });
  });

  it("creates the upcoming message for the next contestant", () => {
    expect(createPickedNotification(false, 456)).toEqual({
      type: "picked",
      message: "You're up after the current battle!",
      timestamp: 456,
    });
  });
});
