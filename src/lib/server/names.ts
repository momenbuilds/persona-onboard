import "server-only";
import { z } from "zod";
import { DEFAULT_AGENT_NAMES, isBlockedAgentName } from "@/lib/conversation/needs";
import { AgentNameSchema } from "@/lib/schema";
import { OPENROUTER_PROVIDER, UNDERSTANDING_MODEL } from "./openrouter";

/** A different creative direction each time, so suggestions never feel canned. */
const STYLES = [
  "short invented words that sound friendly and a little playful",
  "calm nature and weather words",
  "rhythm and music words",
  "craft and making words (tools, materials, textures)",
  "navigation and travel words",
  "light and colour words",
  "small, warm everyday objects",
  "words from their own world: their work, projects and routine",
];

const EXTRA_POOL = [
  "Fern", "Tide", "Ember", "Echo", "Wren", "Juno", "Kit", "Sol", "Pip", "Quill", "Lumen", "Marlo", "Rook", "Vale", "Indie",
  "Cleo", "Bram", "Nell", "Otto", "Remy", "Sage", "Tuck", "Arlo", "Birch", "Cove", "Dune", "Flint", "Haven", "Iris", "Jett",
];

function pickFallback(exclude: string[]) {
  const seen = new Set(exclude.map((n) => n.toLowerCase()));
  const pool = [...DEFAULT_AGENT_NAMES, ...EXTRA_POOL].filter((n) => !seen.has(n.toLowerCase()));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

export type NameContext = { userName: string; summary: string; goals: string[] };

/** Three fresh, personal, product-safe agent names. Never throws. */
export async function freshAgentNames(ctx: NameContext, excludeNames: string[] = []): Promise<string[]> {
  // Never suggest the user's own name for their assistant.
  const exclude = [...excludeNames, ctx.userName.trim()].filter(Boolean);
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return pickFallback(exclude);
  const style = STYLES[Math.floor(Math.random() * STYLES.length)];
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "X-Title": "Persona names" },
      body: JSON.stringify({
        model: UNDERSTANDING_MODEL,
        provider: OPENROUTER_PROVIDER,
        temperature: 1.1,
        max_tokens: 80,
        response_format: { type: "json_object" },
        reasoning: { enabled: false },
        messages: [
          {
            role: "system",
            content:
              'Suggest names for someone\'s personal AI assistant. Return ONLY {"names":[three strings]}. Each name: one word, 3-8 letters, easy to say, feels personal and fits the person. Never celebrities, public figures, fictional characters, brands or existing assistants (Siri, Alexa, Jarvis, Friday...). Never generic words like Assistant, Helper, Bot.',
          },
          {
            role: "user",
            content: `Person: ${ctx.userName || "someone"}. ${ctx.summary} Goals: ${ctx.goals.join("; ")}.\nCreative direction for this batch: ${style}.\nDon't use any of: ${[...exclude, "Ledger", "Tally", "Anchor"].join(", ")}.`,
          },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const content = ((await res.json()) as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? "";
    const parsed = z.object({ names: z.array(z.string()) }).parse(JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1)));
    const seen = new Set(exclude.map((n) => n.toLowerCase()));
    const names = parsed.names
      .map((n) => n.trim().replace(/^\w/, (c) => c.toUpperCase()))
      .filter((n) => AgentNameSchema.safeParse(n).success && !isBlockedAgentName(n) && !seen.has(n.toLowerCase()));
    const unique = [...new Set(names)].slice(0, 3);
    return unique.length === 3 ? unique : [...unique, ...pickFallback([...exclude, ...unique])].slice(0, 3);
  } catch {
    return pickFallback(exclude);
  }
}
