import { describe, expect, it } from "vitest";

import { REFUSAL } from "@/lib/agent/copy";
import { createScriptedModel } from "@/lib/agent/model";
import { runTurn } from "@/lib/agent/run";

describe("no card", () => {
  it("stops the run when the ledger has no match", async () => {
    const result = await runTurn({
      mode: "local",
      message: "Who keeps the atlas card?",
    });

    expect(result.outcome).toBe("refused");
    expect(result.answer).toBe(REFUSAL);
    expect(result.traces.some((trace) => trace.state === "warn")).toBe(true);
    expect(result.traces.some((trace) => trace.label === "stamp · rule quoted")).toBe(false);
  });

  it("drops an invented sentence when no card was opened", async () => {
    const result = await runTurn({
      mode: "live",
      message: "Who keeps the atlas card?",
      model: createScriptedModel([
        { kind: "tool", name: "ledger.search", args: { query: "atlas" } },
        {
          kind: "text",
          text: "The Atlas card is kept by Research, budget 10 ms.",
        },
      ]),
    });

    expect(result.outcome).toBe("refused");
    expect(result.answer).toBe(REFUSAL);
    expect(result.answer).not.toContain("10 ms");
    expect(result.answer).not.toContain("Research");
  });
});
