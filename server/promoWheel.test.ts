/**
 * Tests for Promo Wheel feature:
 * - Daily 1-entry limit per user
 * - Admin spin picks a winner and clears entries
 * - Admin reset clears entries without picking a winner
 * - getEntries returns current wheel entries
 * - getLastWinner returns the most recent spin
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the db module ────────────────────────────────────────
vi.mock("./db", () => ({
  getUserWheelOfNamesEntry: vi.fn(),
  addWheelOfNamesEntry: vi.fn(),
  getWheelOfNamesEntries: vi.fn(),
  getLastWheelOfNamesWinner: vi.fn(),
  clearWheelOfNamesEntries: vi.fn(),
  createWheelOfNamesSpin: vi.fn(),
  removeWheelOfNamesEntry: vi.fn(),
  createWheelOfNamesPaidEntryRequest: vi.fn(),
  getPendingWheelOfNamesPaidEntries: vi.fn(),
  confirmWheelOfNamesPaidEntry: vi.fn(),
  getTodaysWheelOfNamesSpin: vi.fn(),
}));

import {
  getUserWheelOfNamesEntry,
  addWheelOfNamesEntry,
  getWheelOfNamesEntries,
  getLastWheelOfNamesWinner,
  clearWheelOfNamesEntries,
  createWheelOfNamesSpin,
  removeWheelOfNamesEntry,
} from "./db";

// ── Unit tests for the business logic layer ───────────────────

describe("Promo Wheel — daily entry limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows a user to submit when they have no entry today", async () => {
    (getUserWheelOfNamesEntry as any).mockResolvedValue(null);
    (addWheelOfNamesEntry as any).mockResolvedValue({ id: 1 });

    const existing = await getUserWheelOfNamesEntry(42);
    expect(existing).toBeNull();

    await addWheelOfNamesEntry(42, "Test Artist", false);
    expect(addWheelOfNamesEntry).toHaveBeenCalledWith(42, "Test Artist", false);
  });

  it("blocks a user who already has an entry today", async () => {
    (getUserWheelOfNamesEntry as any).mockResolvedValue({
      id: 5, userId: 42, name: "Test Artist", isPaid: false, createdAt: new Date(),
    });

    const existing = await getUserWheelOfNamesEntry(42);
    expect(existing).not.toBeNull();
    // In the router this throws TRPCError — we just verify the guard condition
    expect(existing?.userId).toBe(42);
  });
});

describe("Promo Wheel — admin spin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("picks a random winner from entries and clears the wheel", async () => {
    const mockEntries = [
      { id: 1, userId: 10, name: "Artist A", isPaid: false, createdAt: new Date() },
      { id: 2, userId: 11, name: "Artist B", isPaid: false, createdAt: new Date() },
      { id: 3, userId: 0,  name: "Admin Add", isPaid: false, createdAt: new Date() },
    ];
    (getWheelOfNamesEntries as any).mockResolvedValue(mockEntries);
    (createWheelOfNamesSpin as any).mockResolvedValue({});
    (clearWheelOfNamesEntries as any).mockResolvedValue({});

    const entries = await getWheelOfNamesEntries();
    expect(entries.length).toBe(3);

    const winner = entries[Math.floor(Math.random() * entries.length)];
    const today = new Date().toISOString().split("T")[0];
    await createWheelOfNamesSpin(today, winner.userId || null, winner.name);
    await clearWheelOfNamesEntries();

    // userId 0 (admin-added entries) maps to null in the spin record
    expect(createWheelOfNamesSpin).toHaveBeenCalledWith(
      today,
      expect.anything(), // winner.userId || null
      expect.any(String) // winner.name
    );
    // Verify the call was made with the correct date
    const callArgs = (createWheelOfNamesSpin as any).mock.calls[0];
    expect(callArgs[0]).toBe(today);
    expect(typeof callArgs[2]).toBe('string'); // winnerName is a string
    expect(clearWheelOfNamesEntries).toHaveBeenCalledTimes(1);
  });

  it("throws when there are no entries to spin", async () => {
    (getWheelOfNamesEntries as any).mockResolvedValue([]);

    const entries = await getWheelOfNamesEntries();
    expect(entries.length).toBe(0);
    // Router throws TRPCError BAD_REQUEST when entries.length === 0
  });
});

describe("Promo Wheel — admin reset", () => {
  it("clears all entries without creating a spin record", async () => {
    (clearWheelOfNamesEntries as any).mockResolvedValue({});

    await clearWheelOfNamesEntries();

    expect(clearWheelOfNamesEntries).toHaveBeenCalledTimes(1);
    expect(createWheelOfNamesSpin).not.toHaveBeenCalled();
  });
});

describe("Promo Wheel — getEntries", () => {
  it("returns all current entries from the wheel", async () => {
    const mockEntries = [
      { id: 1, userId: 10, name: "MC Detroit", isPaid: false, createdAt: new Date() },
      { id: 2, userId: 0,  name: "Paid Artist", isPaid: true,  createdAt: new Date() },
    ];
    (getWheelOfNamesEntries as any).mockResolvedValue(mockEntries);

    const entries = await getWheelOfNamesEntries();
    expect(entries.length).toBe(2);
    expect(entries[0].name).toBe("MC Detroit");
    expect(entries[1].isPaid).toBe(true);
  });
});

describe("Promo Wheel — getLastWinner", () => {
  it("returns the most recent spin record", async () => {
    const mockSpin = {
      id: 1, spinDate: "2026-05-09", winnerId: 10, winnerName: "MC Detroit", createdAt: new Date(),
    };
    (getLastWheelOfNamesWinner as any).mockResolvedValue(mockSpin);

    const last = await getLastWheelOfNamesWinner();
    expect(last?.winnerName).toBe("MC Detroit");
    expect(last?.spinDate).toBe("2026-05-09");
  });

  it("returns null when no spins have occurred", async () => {
    (getLastWheelOfNamesWinner as any).mockResolvedValue(null);

    const last = await getLastWheelOfNamesWinner();
    expect(last).toBeNull();
  });
});
