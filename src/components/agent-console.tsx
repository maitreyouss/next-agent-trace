"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import type { RunMode } from "@/lib/agent/run";
import type { Outcome, TraceLine } from "@/lib/agent/trace";

const EXAMPLES = [
  {
    label: "Card opened",
    message: "What does the refusal card allow?",
    failure: false,
  },
  {
    label: "No card",
    message: "Who keeps the atlas card?",
    failure: false,
  },
  {
    label: "Tool failed",
    message: "Open the fallback card.",
    failure: true,
  },
] as const;

const MODE_LABEL: Record<RunMode, string> = {
  demo: "demo",
  local: "local",
  live: "model",
};

type ClientEvent =
  | { type: "meta"; mode: RunMode; budgetMs: number }
  | (TraceLine & { type: "trace" })
  | { type: "token"; text: string }
  | { type: "done"; outcome: Outcome; latencyMs: number; budgetMs: number; mode: RunMode }
  | { type: "error"; error: string };

function statusLabel(outcome: Outcome | null, latencyMs: number | null, running: boolean) {
  if (running && latencyMs === null) return "running";
  if (!outcome || latencyMs === null) return "idle";
  const latency = `${latencyMs} ms`;
  if (outcome === "answered") return `200 · ${latency}`;
  if (outcome === "refused") return `refused · ${latency}`;
  return `fallback · ${latency}`;
}

function statusClass(outcome: Outcome | null, running: boolean) {
  if (running || !outcome) return "text-ink-tertiary";
  if (outcome === "answered") return "text-success";
  return "text-accent-text";
}

export function AgentConsole({ serviceNames }: { serviceNames: string[] }) {
  const [message, setMessage] = useState<string>(EXAMPLES[0].message);
  const [answer, setAnswer] = useState("");
  const [traces, setTraces] = useState<TraceLine[]>([]);
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [budgetMs, setBudgetMs] = useState(1500);
  const [mode, setMode] = useState<RunMode | null>(null);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function ask(text: string, simulateToolFailure: boolean) {
    const question = text.trim();
    if (!question || running) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setMessage(question);
    setAnswer("");
    setTraces([]);
    setOutcome(null);
    setLatencyMs(null);
    setError("");
    setRunning(true);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, simulateToolFailure }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "The request failed.");
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setError("Empty response.");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as ClientEvent;
          if (event.type === "meta") {
            setMode(event.mode);
            setBudgetMs(event.budgetMs);
          } else if (event.type === "trace") {
            setTraces((current) => [
              ...current,
              { time: event.time, label: event.label, state: event.state },
            ]);
          } else if (event.type === "token") {
            setAnswer((current) => current + event.text);
          } else if (event.type === "done") {
            setOutcome(event.outcome);
            setLatencyMs(event.latencyMs);
            setBudgetMs(event.budgetMs);
            setMode(event.mode);
          } else if (event.type === "error") {
            setError(event.error);
          }
        }
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError("The request failed.");
    } finally {
      if (abortRef.current === controller) setRunning(false);
    }
  }

  const sentenceClass =
    outcome === "refused" || outcome === "fallback" ? "text-accent-text" : "text-ink";

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col px-[clamp(18px,5vw,28px)] py-[clamp(48px,8vw,88px)]">
      <header className="mb-10 flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-mono text-[13.5px] text-ink-tertiary">next-agent-trace</p>
        <div className="flex items-center gap-4 font-mono text-[13.5px] text-ink-tertiary">
          {mode ? <span>{MODE_LABEL[mode]}</span> : null}
          <a className="underline decoration-line-strong underline-offset-4 hover:text-ink" href="https://github.com/maitreyouss/next-agent-trace">
            code
          </a>
        </div>
      </header>

      <div className="grid items-start gap-[clamp(36px,6vw,64px)] lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
        <div>
          <p className="mb-8 inline-flex items-center gap-2.5 rounded-pill border border-line-strong px-3 py-1.5 font-mono text-[13.5px] text-ink-secondary">
            <span aria-hidden="true" className="live-dot size-1.5 rounded-full bg-accent" />
            Closed ledger · Paris
          </p>
          <h1 className="mb-6 max-w-[14ch] font-display text-[clamp(36px,5.6vw,62px)] leading-[1.02] font-semibold tracking-[-0.035em] text-balance text-ink-primary">
            A run earns its sentence.
          </h1>
          <p className="mb-10 max-w-[58ch] text-[clamp(17px,1.7vw,20px)] leading-[1.6] text-ink-secondary text-pretty">
            Twenty rules, written once. The agent may quote a card it opened. If the card is not in the ledger, the run stops.
          </p>

          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(message, false);
            }}
          >
            <label className="font-mono text-[13px] text-ink-tertiary" htmlFor="question">
              Run
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="question"
                value={message}
                maxLength={500}
                autoComplete="off"
                disabled={running}
                onChange={(event) => setMessage(event.target.value)}
                className="h-12 min-w-0 flex-1 rounded-control border border-line-strong bg-inset px-3 text-[15.5px] text-ink outline-none focus:border-line-hover disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={running || message.trim().length === 0}
                className="h-12 rounded-control bg-ink-primary px-5 text-[15.5px] font-medium text-page transition-colors duration-200 hover:bg-ink disabled:opacity-50"
              >
                {running ? "Running" : "Run"}
              </button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                disabled={running}
                onClick={() => void ask(example.message, example.failure)}
                className="rounded-chip border border-line bg-surface px-2.5 py-1.5 font-mono text-sm text-ink-secondary hover:text-ink disabled:opacity-50"
              >
                {example.label}
              </button>
            ))}
          </div>

          <div className="mt-8 border-t border-line pt-6">
            <p className="mb-3 font-mono text-[13px] text-ink-tertiary">Sentence</p>
            <p aria-live="polite" className={`min-h-16 text-[17px] leading-[1.6] text-pretty ${sentenceClass}`}>
              {error || answer || (running ? "…" : "The sentence follows the trace.")}
            </p>
          </div>

          <p className="mt-7 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 font-mono text-[13.5px] text-ink-tertiary">
            <span>Trace</span>
            <span>Test</span>
            <span>Latency budget</span>
          </p>
        </div>

        <section
          aria-label="Request trace"
          className="overflow-hidden rounded-panel border border-line bg-page-alt shadow-panel"
        >
          <div className="flex items-center justify-between gap-4 border-b border-line bg-surface px-[18px] py-3.5">
            <span className="font-mono text-sm text-ink-secondary">trace · witness.run</span>
            <span className={`font-mono text-sm ${statusClass(outcome, running)}`}>
              {statusLabel(outcome, latencyMs, running)}
            </span>
          </div>
          <div className="flex min-h-64 flex-col">
            {traces.length === 0 ? (
              <p className="px-[18px] py-4 font-mono text-[13.5px] text-ink-tertiary">
                Search, open, refusal, or fallback. Nothing else is written here.
              </p>
            ) : (
              traces.map((trace, index) => (
                <div
                  key={`${trace.time}-${trace.label}-${index}`}
                  className="trace-row flex items-center gap-3.5 border-b border-line-row px-[18px] py-3 font-mono text-[13.5px]"
                  style={{ "--i": index } as CSSProperties}
                >
                  <span className="w-16 shrink-0 text-ink-tertiary">{trace.time}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-secondary">{trace.label}</span>
                  <span className="shrink-0 text-ink-tertiary">{trace.state}</span>
                </div>
              ))
            )}
          </div>
          <p className="bg-surface px-[18px] py-3.5 font-mono text-[13px] text-ink-tertiary">
            Measured in the header · budget {budgetMs.toLocaleString("en-US")} ms
          </p>
        </section>
      </div>

      <details className="mt-10 font-mono text-[13.5px] text-ink-tertiary">
        <summary className="cursor-pointer">Ledger · {serviceNames.length} rules</summary>
        <p className="mt-3 max-w-3xl leading-relaxed text-ink-secondary">{serviceNames.join(" · ")}</p>
      </details>
    </div>
  );
}
