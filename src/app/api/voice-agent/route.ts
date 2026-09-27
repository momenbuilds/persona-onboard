import { NextResponse } from "next/server";
import type { VoiceAgentSessionResponse } from "@/lib/schema";
import {
  hasVoiceAgentKey,
  mintVoiceToken,
  ONBOARDING_PROMPT,
  onboardingSession,
  VoiceAgentError,
} from "@/lib/server/voice-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tokens are billed to our key, so cap how fast one visitor can start calls.
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

function reply(body: VoiceAgentSessionResponse, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Returns the inline onboarding session config plus a fresh single-use token for one browser session. */
export async function GET(request: Request) {
  if (!hasVoiceAgentKey()) {
    return reply({ ok: false, code: "NO_KEY", message: "Voice agent isn't configured (ASSEMBLYAI_API_KEY)." }, 503);
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return reply({ ok: false, code: "RATE_LIMITED", message: "Too many calls, try again in a few minutes." }, 429);

  try {
    const token = await mintVoiceToken();
    // The base prompt isn't secret; the client re-sends it with the running transcript
    // (session.update) so the agent keeps context across typing and reconnects.
    return reply({ ok: true, session: onboardingSession(), token, systemPrompt: ONBOARDING_PROMPT });
  } catch (error) {
    const status = error instanceof VoiceAgentError ? error.status : 502;
    console.error("[voice-agent]", error instanceof Error ? error.message : error);
    return reply({ ok: false, code: "UPSTREAM", message: "Couldn't start the call." }, status === 503 ? 503 : 502);
  }
}
