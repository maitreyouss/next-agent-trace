import { describe, expect, it } from "vitest";

import { runTurn } from "@/lib/agent/run";

describe("card opened", () => {
  it("opens the refusal rule and quotes its budget", async () => {
    const result = await runTurn({
      mode: "local",
      message: "What does the refusal card allow?",
    });

    expect(result.outcome).toBe("answered");
    expect(result.answer).toContain("Refusal");
    expect(result.answer).toContain("240");
    expect(result.answer).toContain("Trace");
    expect(result.traces.map((trace) => [trace.label, trace.state])).toEqual([
      ["route → witness", "ok"],
      ["ledger.search · What does the refusal card allow?", "ok"],
      ["ledger.open · refusal", "ok"],
      ["stamp · rule quoted", "ok"],
    ]);
  });
});
