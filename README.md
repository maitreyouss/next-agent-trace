# next-agent-trace

A run earns its sentence. The agent quotes a closed ledger of twenty run rules. It may speak only after a card is opened. If the card is not there, the run stops.

[![ci](https://github.com/maitreyouss/next-agent-trace/actions/workflows/ci.yml/badge.svg)](https://github.com/maitreyouss/next-agent-trace/actions/workflows/ci.yml)

## Problem

A demo that invents a fact is not a run. Here the sentence is a quote from one opened card, or it is a refusal, or it is a fallback. The guardrail is in the graph: an empty search or a failed tool drops whatever the model was about to say.

The ledger is the rule set for that behavior. Refusal, fallback, a frozen eval, two tools, no key on the public run. It is not a catalog of products.

## Stack

TypeScript, React, Next.js, LangGraph.js, Zod, Vitest.

Bricolage Grotesque, IBM Plex Sans, IBM Plex Mono. Ink on `#09090b`, amber for the mark, mint only on a finished run.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without `OPENAI_API_KEY`, the same graph runs on a local planner. No network call. `DEMO=true` forces that path even when a key is present. That is the public setting.

With a key, the model node calls `OPENAI_MODEL` (default `gpt-4o-mini`). Every mode is capped per IP, in the memory of the process: 20 runs an hour with a key, 60 without. A new process starts the count again.

```bash
npm test
npm run lint
npm run typecheck
```

## What the tests cover

Three frozen cases, no model call:

- card opened: search, open, quote the Refusal rule and its 240 ms budget
- no card: the run stops, including when the model offers an invented sentence
- tool failed: the open is called, then one fallback line, without rebuilding the card

## Demo

Deploy on Vercel with `DEMO=true` and no key. A visitor replays the three runs from the page. The demo link will be added here once the deployment is wired.

## License

[MIT](LICENSE)
