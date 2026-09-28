import {
  AIMessage,
  type BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { Annotation, END, messagesStateReducer, START, StateGraph } from "@langchain/langgraph";

import type { CatalogOps } from "@/data/catalog";
import { FALLBACK, REFUSAL, SYSTEM_PROMPT } from "@/lib/agent/copy";
import type { AgentModel } from "@/lib/agent/model";
import { callTool, OPEN_TOOL, SEARCH_TOOL } from "@/lib/agent/tools";
import { formatElapsed, type TraceLine } from "@/lib/agent/trace";

type InternalOutcome =
  | "pending"
  | "empty"
  | "tool_error"
  | "answered"
  | "refused"
  | "fallback";

const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  traces: Annotation<TraceLine[]>({
    reducer: (current, next) => current.concat(next),
    default: () => [],
  }),
  outcome: Annotation<InternalOutcome>({
    reducer: (_current, next) => next,
    default: () => "pending",
  }),
  startedAt: Annotation<number>({
    reducer: (_current, next) => next,
    default: () => Date.now(),
  }),
});

type State = typeof GraphState.State;

function line(state: State, label: string, traceState: TraceLine["state"]): TraceLine {
  return {
    time: formatElapsed(Date.now() - state.startedAt),
    label,
    state: traceState,
  };
}

function brief(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= 72) return clean;
  return `${clean.slice(0, 69)}…`;
}

function textContent(message: BaseMessage): string {
  const { content } = message;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        return String(part.text ?? "");
      }
      return "";
    })
    .join("");
}

export function extractAnswer(messages: BaseMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.getType() !== "ai") continue;
    const text = textContent(message).trim();
    if (text) return text;
  }
  return REFUSAL;
}

function readSucceeded(state: State): boolean {
  return state.traces.some(
    (trace) => trace.label.startsWith(OPEN_TOOL) && trace.state === "ok",
  );
}

export function buildGraph(model: AgentModel, ops: CatalogOps) {
  const boot = (state: State) => ({
    traces: [line(state, "route → witness", "ok")],
  });

  const agent = async (state: State) => {
    const response = await model.invoke(state.messages);
    return { messages: [response] };
  };

  const tools = (state: State) => {
    const last = state.messages[state.messages.length - 1];
    const calls = AIMessage.isInstance(last) ? (last.tool_calls ?? []) : [];
    const traces: TraceLine[] = [];
    const messages: ToolMessage[] = [];

    for (const call of calls) {
      const args =
        call.args && typeof call.args === "object"
          ? (call.args as Record<string, unknown>)
          : {};
      const subject =
        call.name === SEARCH_TOOL
          ? brief(String(args.query ?? ""))
          : brief(String(args.id ?? ""));
      const base = `${call.name} · ${subject}`;

      try {
        const content = callTool(ops, call.name, args);
        const parsed = JSON.parse(content) as {
          hits?: unknown[];
          found?: boolean;
        };
        messages.push(
          new ToolMessage({
            content,
            tool_call_id: call.id ?? base,
            name: call.name,
          }),
        );

        if (call.name === SEARCH_TOOL && (parsed.hits?.length ?? 0) === 0) {
          traces.push(line(state, `${base} · no match`, "warn"));
          return { messages, traces, outcome: "empty" as const };
        }
        if (call.name === OPEN_TOOL && parsed.found === false) {
          traces.push(line(state, `${base} · missing`, "warn"));
          return { messages, traces, outcome: "empty" as const };
        }
        traces.push(line(state, base, "ok"));
      } catch {
        messages.push(
          new ToolMessage({
            content: JSON.stringify({ error: "tool_failed" }),
            tool_call_id: call.id ?? base,
            name: call.name,
            status: "error",
          }),
        );
        traces.push(line(state, `${base} · failed`, "error"));
        return { messages, traces, outcome: "tool_error" as const };
      }
    }

    return { messages, traces };
  };

  const guard = (state: State) => {
    if (!readSucceeded(state)) {
      return {
        outcome: "refused" as const,
        messages: [new AIMessage(REFUSAL)],
        traces: [line(state, "guardrail · card not opened", "warn")],
      };
    }
    return {
      outcome: "answered" as const,
      traces: [line(state, "stamp · rule quoted", "ok")],
    };
  };

  const refuse = (state: State) => ({
    outcome: "refused" as const,
    messages: [new AIMessage(REFUSAL)],
    traces: [line(state, "refusal · no card", "warn")],
  });

  const fallback = (state: State) => ({
    outcome: "fallback" as const,
    messages: [new AIMessage(FALLBACK)],
    traces: [line(state, "fallback · answer withheld", "warn")],
  });

  const routeAfterAgent = (state: State) => {
    const last = state.messages[state.messages.length - 1];
    const calls = AIMessage.isInstance(last) ? (last.tool_calls ?? []) : [];
    const turns = state.messages.filter((message) => message.getType() === "ai").length;
    if (calls.length > 0) return turns > 4 ? "fallback" : "tools";
    return "guard";
  };

  const routeAfterTools = (state: State) => {
    if (state.outcome === "tool_error") return "fallback";
    if (state.outcome === "empty") return "refuse";
    return "agent";
  };

  return new StateGraph(GraphState)
    .addNode("boot", boot)
    .addNode("agent", agent)
    .addNode("tools", tools)
    .addNode("guard", guard)
    .addNode("refuse", refuse)
    .addNode("fallback", fallback)
    .addEdge(START, "boot")
    .addEdge("boot", "agent")
    .addConditionalEdges("agent", routeAfterAgent, ["tools", "guard", "fallback"])
    .addConditionalEdges("tools", routeAfterTools, ["agent", "refuse", "fallback"])
    .addEdge("guard", END)
    .addEdge("refuse", END)
    .addEdge("fallback", END)
    .compile();
}

const compiledGraphs = new Map<string, ReturnType<typeof buildGraph>>();

export function compiledGraphCount(): number {
  return compiledGraphs.size;
}

export async function invokeGraph(input: {
  message: string;
  model: AgentModel;
  ops: CatalogOps;
  startedAt?: number;
  cacheKey?: string;
}) {
  const startedAt = input.startedAt ?? Date.now();
  const cached = input.cacheKey ? compiledGraphs.get(input.cacheKey) : undefined;
  const graph = cached ?? buildGraph(input.model, input.ops);
  if (input.cacheKey && !cached) compiledGraphs.set(input.cacheKey, graph);
  return graph.invoke(
    {
      messages: [new SystemMessage(SYSTEM_PROMPT), new HumanMessage(input.message)],
      startedAt,
      outcome: "pending",
      traces: [],
    },
    { recursionLimit: 12 },
  );
}
