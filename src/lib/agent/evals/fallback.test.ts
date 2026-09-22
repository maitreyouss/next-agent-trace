import { describe, expect, it } from "vitest";

import { FALLBACK } from "@/lib/agent/copy";
import { runTurn } from "@/lib/agent/run";

describe("tool failed", () => {
  it("opens the tool, then withholds the card", async () => {
    const result = await runTurn({
      mode: "local",
      message: "Open the fallback card.",
      simulateToolFailure: true,
    });

    expect(result.outcome).toBe("fallback");
    expect(result.answer).toBe(FALLBACK);
    expect(result.answer).not.toContain("180");
    expect(result.traces.map((trace) => trace.state)).toEqual(["ok", "ok", "error", "warn"]);
    expect(result.traces[1]?.label.startsWith("ledger.search")).toBe(true);
    expect(result.traces[2]?.label).toContain("ledger.open");
    expect(result.traces[2]?.label).toContain("failed");
    expect(result.traces[3]?.label).toBe("fallback · answer withheld");
  });
});
