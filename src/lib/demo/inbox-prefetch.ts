import type { InboxEmail } from "@/lib/schema";

/**
 * DEMO inbox, built from the user's own onboarding answers. Generating it takes
 * several seconds, so it starts in the background on the summary screen and the
 * Gmail step usually finds it ready.
 */
export type InboxRequest = {
  userName: string;
  summary: string;
  primaryGoal: string;
  secondaryGoals: string[];
  notes?: Record<string, string>;
};

let pending: { key: string; promise: Promise<InboxEmail[]> } | null = null;

export function prefetchInbox(body: InboxRequest): Promise<InboxEmail[]> {
  const key = `${body.summary}\n${body.primaryGoal}`;
  if (pending?.key === key) return pending.promise;
  const promise = fetch("/api/inbox", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { inbox?: InboxEmail[] } | null) => d?.inbox ?? [])
    .catch(() => [] as InboxEmail[]);
  pending = { key, promise };
  // A failed attempt shouldn't stick; the next call retries.
  void promise.then((emails) => {
    if (!emails.length && pending?.promise === promise) pending = null;
  });
  return promise;
}
