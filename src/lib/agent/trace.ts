export type TraceState = "ok" | "warn" | "error";

export type Outcome = "answered" | "refused" | "fallback";

export type TraceLine = {
  time: string;
  label: string;
  state: TraceState;
};

export function formatElapsed(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const hundredths = Math.floor(safe / 10) % 100;
  const totalSeconds = Math.floor(safe / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(minutes)}:${pad(seconds)}.${pad(hundredths)}`;
}
