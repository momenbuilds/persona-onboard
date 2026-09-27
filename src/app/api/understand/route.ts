import { NextResponse } from "next/server";
import { fallbackFromMessages } from "@/lib/conversation/fallback";
import { UnderstandRequestSchema, type UnderstandResponse } from "@/lib/schema";
import { freshAgentNames } from "@/lib/server/names";
import { hasOpenRouterKey, understandWithDeepSeek } from "@/lib/server/openrouter";
import { estimateSavings } from "@/lib/server/savings";
import { rateLimited } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  if (rateLimited(request, "understand", 20)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const json = await request.json().catch(() => null);
  const parsed = UnderstandRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Expected { messages: ChatMessage[] }" }, { status: 400 });
  }
  const { messages, notes } = parsed.data;

  // Deterministic understanding from the same engine that ran the call.
  const fallback = fallbackFromMessages(messages);
  const said = messages.filter((m) => m.role === "user").map((m) => m.text).join(" ");

  let body: UnderstandResponse;
  if (!hasOpenRouterKey()) {
    body = {
      understanding: { ...fallback, timeSavings: await estimateSavings(said, notes) },
      source: "fallback",
      note: "OPENROUTER_API_KEY not set",
    };
  } else {
    try {
      // Fresh, personal name ideas and the time-savings estimate run in parallel,
      // so neither adds to the wait.
      const [understanding, names, timeSavings] = await Promise.all([
        understandWithDeepSeek(messages, fallback, notes),
        freshAgentNames({ userName: notes?.userName ?? "", summary: said.slice(0, 600), goals: [notes?.goals ?? "", notes?.needs ?? ""] }),
        estimateSavings(said, notes),
      ]);
      body = {
        understanding: {
          ...understanding,
          userName: understanding.userName || fallback.userName,
          suggestedAgentNames: withoutUserName(names.length === 3 ? names : understanding.suggestedAgentNames, understanding.userName || fallback.userName),
          timeSavings,
        },
        source: "deepseek",
      };
    } catch (error) {
      const note = error instanceof Error ? error.message : "model call failed";
      console.error("[understand]", note);
      body = { understanding: { ...fallback, timeSavings: await estimateSavings(said, notes) }, source: "fallback", note };
    }
  }

  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}

/** The user's own name is never offered as their assistant's name. */
function withoutUserName(names: string[], userName: string) {
  const own = userName.trim().toLowerCase();
  if (!own || !names.some((n) => n.toLowerCase() === own)) return names;
  const spare = ["Wren", "Juno", "Nova", "Pace", "Echo"].filter((n) => n.toLowerCase() !== own && !names.includes(n));
  return names.map((n) => (n.toLowerCase() === own ? spare.shift()! : n));
}
