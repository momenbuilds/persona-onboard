import { NextResponse } from "next/server";
import { fallbackFromMessages } from "@/lib/conversation/fallback";
import { UnderstandRequestSchema, type UnderstandResponse } from "@/lib/schema";
import { freshAgentNames } from "@/lib/server/names";
import { hasOpenRouterKey, understandWithDeepSeek } from "@/lib/server/openrouter";
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

  let body: UnderstandResponse;
  if (!hasOpenRouterKey()) {
    body = { understanding: fallback, source: "fallback", note: "OPENROUTER_API_KEY not set" };
  } else {
    try {
      // Fresh, personal name ideas are generated in parallel (a different creative
      // direction every time) so they never repeat the same few words.
      const said = messages.filter((m) => m.role === "user").map((m) => m.text).join(" ").slice(0, 600);
      const [understanding, names] = await Promise.all([
        understandWithDeepSeek(messages, fallback, notes),
        freshAgentNames({ userName: notes?.userName ?? "", summary: said, goals: [notes?.goals ?? "", notes?.needs ?? ""] }),
      ]);
      body = {
        understanding: {
          ...understanding,
          userName: understanding.userName || fallback.userName,
          suggestedAgentNames: names.length === 3 ? names : understanding.suggestedAgentNames,
        },
        source: "deepseek",
      };
    } catch (error) {
      const note = error instanceof Error ? error.message : "model call failed";
      console.error("[understand]", note);
      body = { understanding: fallback, source: "fallback", note };
    }
  }

  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
