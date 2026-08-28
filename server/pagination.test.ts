import { describe, expect, it } from "vitest";
import { getPageMeta } from "@shared/pagination";

describe("admin pagination metadata", () => {
  it("reports total pages and hasMore for a middle page", () => {
    expect(getPageMeta(51, 2, 25)).toEqual({
      page: 2,
      pageSize: 25,
      total: 51,
      totalPages: 3,
      hasMore: true,
    });
  });

  it("reports the final page correctly", () => {
    expect(getPageMeta(51, 3, 25).hasMore).toBe(false);
  });

  it("reports an empty result without inventing a page", () => {
    expect(getPageMeta(0, 1, 25)).toEqual({
      page: 1,
      pageSize: 25,
      total: 0,
      totalPages: 0,
      hasMore: false,
    });
  });
});
