import { describe, expect, it } from "vitest";

import { streamTurn } from "@/lib/agent/stream";

describe("stream", () => {
  it("stops after the client disconnects", async () => {
    const controller = new AbortController();
    const events = [];
    for await (const event of streamTurn(
      { mode: "local", message: "What does the refusal card allow?" },
      controller.signal,
    )) {
      events.push(event.type);
      controller.abort();
    }

    expect(events).toEqual(["meta"]);
  });
});
