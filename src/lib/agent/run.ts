import { createCatalogOps, type CatalogOps } from "@/data/catalog";
import { FALLBACK, REQUEST_BUDGET_MS } from "@/lib/agent/copy";
import { extractAnswer, invokeGraph } from "@/lib/agent/graph";
import {
  createLiveModel,
  createLocalModel,
  type AgentModel,
} from "@/lib/agent/model";
import { formatElapsed, type Outcome, type TraceLine } from "@/lib/agent/trace";

const localModel = createLocalModel();
const liveModel = createLiveModel();

export type RunMode = "demo" | "local" | "live";

export type RunInput = {
  message: string;
  mode?: RunMode;
  model?: AgentModel;
  ops?: CatalogOps;
  simulateToolFailure?: boolean;
};

export type RunResult = {
  mode: RunMode;
  outcome: Outcome;
  answer: string;
  traces: TraceLine[];
  latencyMs: number;
};

export function resolveMode(env: NodeJS.ProcessEnv = process.env): RunMode {
  if (env.DEMO === "true") return "demo";
  if (!env.OPENAI_API_KEY) return "local";
  return "live";
}

function publicOutcome(value: string): Outcome {
  if (value === "answered" || value === "refused" || value === "fallback") return value;
  if (value === "tool_error") return "fallback";
  return "refused";
}

export function forcedToolFailure(mode: RunMode, requested: boolean | undefined): boolean {
  return mode !== "live" && requested === true;
}

function graphCacheKey(input: RunInput, mode: RunMode): string | undefined {
  if (input.model || input.ops) return undefined;
  if (mode === "live") return "live";
  return forcedToolFailure(mode, input.simulateToolFailure) ? "planner-failure" : "planner";
}

export async function runTurn(input: RunInput): Promise<RunResult> {
  const mode = input.mode ?? resolveMode();
  const startedAt = Date.now();
  const ops =
    input.ops ??
    (forcedToolFailure(mode, input.simulateToolFailure)
      ? createCatalogOps({
          read() {
            throw new Error("timeout");
          },
        })
      : createCatalogOps());
  const model = input.model ?? (mode === "live" ? liveModel : localModel);
  const cacheKey = graphCacheKey(input, mode);

  try {
    const state = await invokeGraph({
      message: input.message,
      model,
      ops,
      startedAt,
      cacheKey,
    });
    const latencyMs = Date.now() - startedAt;
    const traces = [...state.traces];
    if (latencyMs > REQUEST_BUDGET_MS) {
      traces.push({
        time: formatElapsed(latencyMs),
        label: "latency budget exceeded",
        state: "warn",
      });
    }
    return {
      mode,
      outcome: publicOutcome(state.outcome),
      answer: extractAnswer(state.messages),
      traces,
      latencyMs,
    };
  } catch {
    const latencyMs = Date.now() - startedAt;
    return {
      mode,
      outcome: "fallback",
      answer: FALLBACK,
      traces: [
        { time: formatElapsed(0), label: "route → witness", state: "ok" },
        { time: formatElapsed(latencyMs), label: "llm · unavailable", state: "error" },
        {
          time: formatElapsed(latencyMs),
          label: "fallback · answer withheld",
          state: "warn",
        },
      ],
      latencyMs,
    };
  }
}
