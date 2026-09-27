import { NextResponse } from "next/server";
import type { ChatEvent } from "@/lib/chat/protocol";
import { dashboardReply } from "@/lib/conversation/dashboard-reply";
import { ChatRequestSchema } from "@/lib/schema";
import { streamChat } from "@/lib/server/chat";
import { hasOpenRouterKey } from "@/lib/server/openrouter";
import { rateLimited } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Dashboard chat. Streams newline-delimited JSON events (see ChatEvent):
 * text deltas, chart/document artifacts, reminders, done.
 * DeepSeek V4.1 Flash via OpenRouter; deterministic local replies without a key.
 */
export async function POST(request: Request) {
  if (rateLimited(request, "chat", 60)) {
    return NextResponse.json({ error: "Slow down a little — try again in a few minutes." }, { status: 429 });
  }
  const parsed = ChatRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid chat request" }, { status: 400 });
  const req = parsed.data;
  const last = [...req.messages].reverse().find((m) => m.role === "user")?.text ?? "";

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let wrote = false;
      const emit = (e: ChatEvent) => {
        if (e.t === "delta" || e.t === "artifact" || e.t === "artifact-start" || e.t === "reminder") wrote = true;
        controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      };
      const fallback = () => {
        const r = dashboardReply(last, {
          agent: req.profile.agentName,
          userName: req.profile.userName,
          primaryGoal: req.profile.primaryGoal || "life admin",
        });
        emit({ t: "delta", v: r.reply });
        if (r.reminder) emit({ t: "reminder", reminder: r.reminder });
        emit({ t: "done", source: "fallback" });
      };

      if (!hasOpenRouterKey()) fallback();
      else {
        try {
          await streamChat(req, emit, request.signal);
          emit({ t: "done", source: "deepseek" });
        } catch (error) {
          console.error("[chat]", error instanceof Error ? error.message : error);
          if (wrote) emit({ t: "error", message: "the connection dropped mid-reply." });
          else fallback();
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
