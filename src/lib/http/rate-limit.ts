const buckets = new Map<string, number[]>();

export function allow(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): boolean {
  const cutoff = now - windowMs;
  const recent = (buckets.get(key) ?? []).filter((stamp) => stamp > cutoff);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  return true;
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "local";
}
