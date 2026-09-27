import "server-only";

/**
 * Tiny in-memory sliding-window limiter. Every paid API route sits behind it so
 * one visitor can't run up the AssemblyAI / OpenRouter bill. Per-instance on
 * serverless, which is fine for a demo; use a shared store (e.g. Redis) at scale.
 */
const buckets = new Map<string, number[]>();

export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

/** Returns true when this call is over the limit. */
export function rateLimited(request: Request, bucket: string, max: number, windowMs = 10 * 60_000) {
  const key = `${bucket}:${clientIp(request)}`;
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 5000) buckets.clear();
  return recent.length > max;
}
