import { describe, expect, it } from "vitest";

import { allow, runLimit } from "@/lib/http/rate-limit";

describe("rate limit", () => {
  it("opens the window again after it expires", () => {
    const key = "rate-limit-window";
    expect(allow(key, 1, 1_000, 0)).toBe(true);
    expect(allow(key, 1, 1_000, 500)).toBe(false);
    expect(allow(key, 1, 1_000, 1_001)).toBe(true);
  });

  it("keeps a tighter cap on the live model", () => {
    expect(runLimit("live")).toEqual({ limit: 20, windowMs: 60 * 60 * 1000 });
    expect(runLimit("demo").limit).toBe(60);
    expect(runLimit("local").limit).toBe(60);
  });
});
