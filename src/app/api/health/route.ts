import { NextResponse } from "next/server";
import type { HealthResponse } from "@/lib/schema";
import { hasAssemblyKey } from "@/lib/server/assemblyai";
import { hasOpenRouterKey } from "@/lib/server/openrouter";

export const dynamic = "force-dynamic";

/** Which integrations are configured — booleans only, never the keys themselves. */
export async function GET() {
  const body: HealthResponse = {
    transcription: hasAssemblyKey(),
    understanding: hasOpenRouterKey(),
    // Same key powers the live voice agent.
    voice: hasAssemblyKey(),
  };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
