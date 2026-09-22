import { REQUEST_BUDGET_MS } from "@/lib/agent/copy";
import { runTurn, type RunInput, type RunMode } from "@/lib/agent/run";
import { formatElapsed, type Outcome, type TraceState } from "@/lib/agent/trace";

const STEP_MS = 120;
const TOKEN_MS = 16;

export type ClientEvent =
  | { type: "meta"; mode: RunMode; budgetMs: number }
  | { type: "trace"; time: string; label: string; state: TraceState }
  | { type: "token"; text: string }
  | {
      type: "done";
      outcome: Outcome;
      latencyMs: number;
      budgetMs: number;
      mode: RunMode;
    };

function sleep(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timer = setTimeout(finish, ms);
    function finish() {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }
    function onAbort() {
      clearTimeout(timer);
      finish();
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function* streamTurn(
  input: RunInput,
  signal?: AbortSignal,
): AsyncGenerator<ClientEvent> {
  if (signal?.aborted) return;
  const result = await runTurn(input);
  if (signal?.aborted) return;
  yield { type: "meta", mode: result.mode, budgetMs: REQUEST_BUDGET_MS };

  const showRealClock = result.latencyMs >= 80;
  let elapsed = 0;
  for (const line of result.traces) {
    if (signal?.aborted) return;
    elapsed += STEP_MS;
    yield {
      type: "trace",
      time: showRealClock ? line.time : formatElapsed(elapsed),
      label: line.label,
      state: line.state,
    };
    await sleep(showRealClock ? 40 : STEP_MS, signal);
  }

  for (const part of result.answer.split(/(\s+)/)) {
    if (signal?.aborted) return;
    if (!part) continue;
    yield { type: "token", text: part };
    if (part.trim()) await sleep(TOKEN_MS, signal);
  }

  if (signal?.aborted) return;
  yield {
    type: "done",
    outcome: result.outcome,
    latencyMs: result.latencyMs,
    budgetMs: REQUEST_BUDGET_MS,
    mode: result.mode,
  };
}
