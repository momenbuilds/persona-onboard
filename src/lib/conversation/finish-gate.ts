/**
 * Guards the voice agent's finish_onboarding call. The hosted model sometimes
 * tries to wrap up after one short answer; unless the user asked to stop, the
 * call only ends once every item is actually filled in.
 */
export const FINISH_ITEMS = [
  { key: "userName", ask: "their first name" },
  { key: "needs", ask: "what they want help with, specifically" },
  { key: "goals", ask: "what they're working toward right now" },
  { key: "routine", ask: "what a normal day looks like for them" },
] as const;

export type FinishItem = (typeof FINISH_ITEMS)[number]["key"];

const PLACEHOLDER = /^(n\/?a|none|unknown|not (yet )?(mentioned|provided|given|specified|shared|known)|tbd|-|\?|null|undefined)\.?$/i;

function filled(value: unknown) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  return v.length >= 2 && !PLACEHOLDER.test(v);
}

export type FinishDecision =
  | { accept: true }
  | { accept: false; missing: FinishItem[]; result: Record<string, unknown> };

export function reviewFinish(args: Record<string, unknown>, userAskedToStop: boolean): FinishDecision {
  if (userAskedToStop || args.user_wants_to_stop === true) return { accept: true };
  const missing = FINISH_ITEMS.filter((item) => !filled(args[item.key]));
  if (!missing.length) return { accept: true };
  const next = missing[0];
  return {
    accept: false,
    missing: missing.map((m) => m.key),
    result: {
      ok: false,
      error: "onboarding is not finished",
      still_missing: missing.map((m) => m.ask),
      instruction: `Do not end the call, say goodbye or say you have everything. Briefly react to what they just said, then ask one short, specific question about ${next.ask}.`,
    },
  };
}
