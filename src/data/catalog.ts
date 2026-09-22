export type ServiceStatus = "ok" | "degraded" | "down";

export type LedgerCard = {
  id: string;
  name: string;
  desk: string;
  owner: string;
  latencyBudgetMs: number;
  status: ServiceStatus;
  summary: string;
};

export type SearchHit = {
  id: string;
  name: string;
  desk: string;
};

export const CATALOG: LedgerCard[] = [
  {
    id: "refusal",
    name: "Refusal",
    desk: "Trace",
    owner: "Trace",
    latencyBudgetMs: 240,
    status: "ok",
    summary: "If the ledger has no card, the run stops. No nearest guess.",
  },
  {
    id: "fallback",
    name: "Fallback",
    desk: "Trace",
    owner: "Trace",
    latencyBudgetMs: 180,
    status: "ok",
    summary: "A failed tool serves one line. The card is not rebuilt from memory.",
  },
  {
    id: "witness",
    name: "Witness",
    desk: "Trace",
    owner: "Trace",
    latencyBudgetMs: 40,
    status: "ok",
    summary: "A run may speak only after a card is opened.",
  },
  {
    id: "twotools",
    name: "Two tools",
    desk: "Scope",
    owner: "Scope",
    latencyBudgetMs: 60,
    status: "ok",
    summary: "Search the ledger, then open one card. A third tool is another product.",
  },
  {
    id: "evalgate",
    name: "Eval gate",
    desk: "Proof",
    owner: "Proof",
    latencyBudgetMs: 80,
    status: "ok",
    summary: "The three cases are frozen. CI never calls a live model.",
  },
  {
    id: "guardrail",
    name: "Guardrail",
    desk: "Proof",
    owner: "Proof",
    latencyBudgetMs: 50,
    status: "ok",
    summary: "The prompt asks. The graph decides.",
  },
  {
    id: "verbatim",
    name: "Verbatim",
    desk: "Proof",
    owner: "Proof",
    latencyBudgetMs: 30,
    status: "ok",
    summary: "A number in the answer must be a number from the opened card.",
  },
  {
    id: "latmark",
    name: "Latency mark",
    desk: "Trace",
    owner: "Trace",
    latencyBudgetMs: 1500,
    status: "ok",
    summary: "Crossing the run budget writes a warn. It does not erase the run.",
  },
  {
    id: "demokey",
    name: "Demo key",
    desk: "Handover",
    owner: "Handover",
    latencyBudgetMs: 20,
    status: "ok",
    summary: "The public run does not carry a model key.",
  },
  {
    id: "ratecap",
    name: "Rate cap",
    desk: "Handover",
    owner: "Handover",
    latencyBudgetMs: 100,
    status: "ok",
    summary: "A live model is capped per address. The cap is a line, not a surprise.",
  },
  {
    id: "streamorder",
    name: "Stream order",
    desk: "Trace",
    owner: "Trace",
    latencyBudgetMs: 120,
    status: "ok",
    summary: "The trace is written before the sentence, so the steps stay readable.",
  },
  {
    id: "ownerline",
    name: "Owner line",
    desk: "Handover",
    owner: "Handover",
    latencyBudgetMs: 70,
    status: "ok",
    summary: "Every card names who keeps it. An unnamed card is not shipped.",
  },
  {
    id: "scopecut",
    name: "Scope cut",
    desk: "Scope",
    owner: "Scope",
    latencyBudgetMs: 200,
    status: "degraded",
    summary: "Automate the step that pays. The rest stays marked out of scope.",
  },
  {
    id: "handover",
    name: "Handover",
    desk: "Handover",
    owner: "Handover",
    latencyBudgetMs: 300,
    status: "ok",
    summary: "The team that keeps the agent can read the trace without the author in the room.",
  },
  {
    id: "firstline",
    name: "First line",
    desk: "Trace",
    owner: "Trace",
    latencyBudgetMs: 90,
    status: "ok",
    summary: "The first line of a run is a trace, not a greeting.",
  },
  {
    id: "frozen",
    name: "Frozen cases",
    desk: "Proof",
    owner: "Proof",
    latencyBudgetMs: 110,
    status: "ok",
    summary: "Found, missing, and a failed tool. The page replays those three. The ledger does not grow from the page.",
  },
  {
    id: "paris",
    name: "Paris stamp",
    desk: "Scope",
    owner: "Scope",
    latencyBudgetMs: 10,
    status: "ok",
    summary: "The work is signed from Paris. The ledger is not a platform.",
  },
  {
    id: "closeout",
    name: "Closeout",
    desk: "Trace",
    owner: "Trace",
    latencyBudgetMs: 140,
    status: "ok",
    summary: "When the run ends, the header shows measured time against the budget.",
  },
  {
    id: "promptlimit",
    name: "Prompt limit",
    desk: "Proof",
    owner: "Proof",
    latencyBudgetMs: 55,
    status: "down",
    summary: "A longer prompt does not unlock a fact that was never opened.",
  },
  {
    id: "replay",
    name: "Replay",
    desk: "Handover",
    owner: "Handover",
    latencyBudgetMs: 75,
    status: "ok",
    summary: "A visitor can replay the three runs. Nothing new is written back.",
  },
];

export const serviceNames = CATALOG.map((card) => card.name);

const FOLD = /[\u0300-\u036f]/g;

export function fold(value: string): string {
  return value.normalize("NFD").replace(FOLD, "").toLowerCase();
}

function scoreCard(query: string, tokens: string[], card: LedgerCard): number {
  const id = fold(card.id);
  const name = fold(card.name);
  let score = 0;
  if (query.includes(id) || query.includes(name)) score += 5;
  for (const token of tokens) {
    if (token === id || token === name) score += 4;
    else if (id.includes(token) || name.includes(token)) score += 3;
  }
  return score;
}

export function searchCatalog(query: string, cards: LedgerCard[] = CATALOG): SearchHit[] {
  const folded = fold(query).trim();
  if (!folded) return [];
  const tokens = folded.split(/[^a-z0-9]+/).filter((token) => token.length > 2);
  return cards
    .map((card) => ({ card, score: scoreCard(folded, tokens, card) }))
    .filter((entry) => entry.score >= 3)
    .sort(
      (a, b) => b.score - a.score || a.card.name.localeCompare(b.card.name, "en"),
    )
    .slice(0, 5)
    .map(({ card }) => ({
      id: card.id,
      name: card.name,
      desk: card.desk,
    }));
}

export function readCard(id: string, cards: LedgerCard[] = CATALOG): LedgerCard | null {
  const key = fold(id.trim());
  if (!key) return null;
  return cards.find((card) => fold(card.id) === key || fold(card.name) === key) ?? null;
}

export type CatalogOps = {
  search: (query: string) => SearchHit[];
  read: (id: string) => LedgerCard | null;
};

export function createCatalogOps(overrides?: Partial<CatalogOps>): CatalogOps {
  return {
    search: overrides?.search ?? ((query) => searchCatalog(query)),
    read: overrides?.read ?? ((id) => readCard(id)),
  };
}
