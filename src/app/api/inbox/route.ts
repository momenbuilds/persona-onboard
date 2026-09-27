import { NextResponse } from "next/server";
import { z } from "zod";
import { generateInbox } from "@/lib/server/inbox";
import { rateLimited } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  userName: z.string().max(40).default(""),
  summary: z.string().max(600),
  primaryGoal: z.string().max(200),
  secondaryGoals: z.array(z.string().max(200)).max(6).default([]),
  notes: z.record(z.string(), z.string().max(2000)).optional(),
});

/** DEMO inbox for the mocked Gmail connection (sample emails built from the user's answers). */
export async function POST(request: Request) {
  if (rateLimited(request, "inbox", 10)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  return NextResponse.json(await generateInbox(parsed.data), { headers: { "cache-control": "no-store" } });
}
