import type { LedgerCard, ServiceStatus } from "@/data/catalog";

export const REQUEST_BUDGET_MS = 1500;

export const REFUSAL = "That card is not in the ledger. The run stops.";

export const FALLBACK = "The tool failed. The card is not rebuilt from memory.";

export const SYSTEM_PROMPT = `You quote a closed ledger of run rules. You know nothing outside the tools.

- Call ledger.search with the user's question.
- If at least one card comes back, call ledger.open with its exact id.
- Answer in English, in one short sentence, using only fields from the opened card: name, desk, latency budget, status, summary.
- Invent no rule, no desk, and no number.
- If no tool returned a card, do not write an answer.`;

const STATUS_LABEL: Record<ServiceStatus, string> = {
  ok: "ok",
  degraded: "degraded",
  down: "down",
};

export function formatAnswer(card: LedgerCard): string {
  return `${card.name} is kept by ${card.owner}. Latency budget: ${card.latencyBudgetMs} ms. Status: ${STATUS_LABEL[card.status]}. ${card.summary}`;
}
