import { NextResponse } from "next/server";
import { z } from "zod";
import { freshAgentNames } from "@/lib/server/names";
import { rateLimited } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const Body = z.object({
  userName: z.string().max(40).default(""),
  summary: z.string().max(600).default(""),
  goals: z.array(z.string().max(200)).max(6).default([]),
  exclude: z.array(z.string().max(40)).max(40).default([]),
});

/** Three fresh agent-name ideas from the user's own data ("shuffle"). */
export async function POST(request: Request) {
  if (rateLimited(request, "names", 40)) return NextResponse.json({ error: "Too many shuffles" }, { status: 429 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { exclude, ...ctx } = parsed.data;
  return NextResponse.json({ names: await freshAgentNames(ctx, exclude) }, { headers: { "cache-control": "no-store" } });
}
