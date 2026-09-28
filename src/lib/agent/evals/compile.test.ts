import { describe, expect, it } from "vitest";

import { compiledGraphCount } from "@/lib/agent/graph";
import { runTurn } from "@/lib/agent/run";

describe("compiled graph", () => {
  it("reuses one graph for repeated planner runs", async () => {
    const before = compiledGraphCount();

    await runTurn({ mode: "local", message: "What does the refusal card allow?" });
    await runTurn({ mode: "demo", message: "Who keeps the handover card?" });
    await runTurn({
      mode: "local",
      message: "Open the fallback card.",
      simulateToolFailure: true,
    });
    await runTurn({
      mode: "demo",
      message: "Open the fallback card.",
      simulateToolFailure: true,
    });

    expect(compiledGraphCount()).toBe(before + 2);
  });
});
