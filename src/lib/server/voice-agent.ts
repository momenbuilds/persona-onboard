import "server-only";

/**
 * AssemblyAI Voice Agent API — the live onboarding call.
 * Real-time speech-to-text (Universal streaming), turn detection, barge-in and
 * natural TTS in one WebSocket. The browser only ever gets a single-use token.
 * Docs: https://www.assemblyai.com/docs/voice-agents/voice-agent-api
 */
const API = "https://agents.assemblyai.com/v1";

/** English voices: alba, eve, george, jane, jean, mary, michael (US) · anna, charles, paul, vera (UK). */
export const DEFAULT_VOICE = "alba";

export class VoiceAgentError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

export function hasVoiceAgentKey() {
  return !!process.env.ASSEMBLYAI_API_KEY?.trim();
}

export const ONBOARDING_PROMPT = `You are Persona, a personal AI assistant, on a short onboarding call with someone who just signed up. Your job is to genuinely understand them so you're useful from day one.
Speak like a warm, relaxed friend: one or two short sentences per turn, plain spoken English, no lists, no emoji.
Write everything in lowercase except people's names.

Before you finish, you need all four of these:
1. their first name
2. what they want help with, specifically (which tasks, which apps, what keeps slipping)
3. their goals: what they're working toward right now
4. their routine: a rough picture of a normal day (if they already described their day, that counts)

How to run the call:
- Every turn, first reflect back the specific details they just said, using their words, then ask for one thing that is still missing or too vague.
- If an answer is vague, ask one concrete follow-up. For example "i need help with work" becomes "what part of work eats most of your time?"
- Never re-ask something they already told you. If one answer covers several items, skip those items.
- If they ask whether you can hear them, say yes in a few words and repeat your last question.
- If an answer is messy or off-topic, react lightly and steer back with an easy example, like their inbox, content or calendar. Never pretend to know things you can't, like last night's game or the news.
- If they correct their name, use the new name and confirm it once.
- Never ask what they want to call their assistant; that happens after the call. Don't give advice or do tasks yet.
- Keep it brief: usually three to five questions in total.

Only when you have all four, or they say they're done or want to stop, call finish_onboarding with everything you learned, then say one short closing line like "perfect, maya. give me a sec to put it together."`;

export const FINISH_TOOL = {
  name: "finish_onboarding",
  description:
    "Call once you know the user's first name, what they want help with, their goals and their routine, or when they want to stop. Include every specific detail they shared.",
  parameters: {
    type: "object",
    properties: {
      userName: { type: "string", description: "The user's first name, as they last stated it" },
      needs: { type: "string", description: "What they want help with, with the specific tasks and apps they mentioned" },
      goals: { type: "string", description: "What they're working toward right now" },
      routine: { type: "string", description: "Their normal day or week, and when they're busiest" },
      details: { type: "string", description: "Any other specifics worth remembering (people, projects, deadlines, preferences)" },
    },
    required: ["needs"],
  },
};

export type VoiceSessionConfig = ReturnType<typeof onboardingSession>;

/**
 * Inline session config, sent by the browser as its first `session.update`.
 * Inline rather than a stored agent: stored agents live in one AssemblyAI region,
 * while the browser's WebSocket may land in another and get `agent_not_found`.
 */
export function onboardingSession(voice = process.env.PERSONA_VOICE?.trim() || DEFAULT_VOICE) {
  return {
    system_prompt: ONBOARDING_PROMPT,
    output: { type: "audio" as const, voice },
    input: {
      // Most accurate transcript and the most patient end-of-turn: people think out loud
      // when describing their day. Turn detection stays on AssemblyAI's adaptive default
      // (setting min/max_silence would disable its semantic pacing).
      transcription_mode: "max_accuracy",
      transcription_prompt:
        "A new user on an onboarding call describing their name, daily routine, work, goals and what they want an AI assistant to help with. Expect app names like Gmail, Instagram, TikTok, Notion, Slack and Google Calendar.",
      keyterms: ["Persona", "Gmail", "Instagram", "TikTok", "Notion", "Slack", "Google Calendar"],
    },
    tools: [{ type: "function" as const, ...FINISH_TOOL }],
  };
}

/** Single-use browser token: must be redeemed within 2 minutes, session capped at 15 minutes. */
export async function mintVoiceToken(): Promise<string> {
  const key = process.env.ASSEMBLYAI_API_KEY?.trim();
  if (!key) throw new VoiceAgentError("ASSEMBLYAI_API_KEY is not set", 503);
  const url = new URL(`${API}/token`);
  url.searchParams.set("expires_in_seconds", "120");
  url.searchParams.set("max_session_duration_seconds", "900");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new VoiceAgentError(`token request failed (${res.status})`, res.status === 401 ? 401 : 502);
  const { token } = (await res.json()) as { token?: string };
  if (!token) throw new VoiceAgentError("token response had no token");
  return token;
}
