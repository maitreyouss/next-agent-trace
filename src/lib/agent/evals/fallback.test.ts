import { describe, expect, it } from "vitest";

import { FALLBACK } from "@/lib/agent/copy";
import { createLocalModel } from "@/lib/agent/model";
import { forcedToolFailure, runTurn } from "@/lib/agent/run";

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

  it("ignores a forced failure when the model is live", async () => {
    expect(forcedToolFailure("live", true)).toBe(false);
    expect(forcedToolFailure("demo", true)).toBe(true);

    const result = await runTurn({
      mode: "live",
      message: "Open the fallback card.",
      simulateToolFailure: true,
      model: createLocalModel(),
    });

    expect(result.outcome).toBe("answered");
    expect(result.answer).toContain("Fallback");
    expect(result.answer).toContain("180");
  });
});
