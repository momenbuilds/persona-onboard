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

You must learn all four of these, in this order, skipping any they've already covered:
1. name: their first name
2. needs: what they want help with, specifically (which tasks, what keeps slipping)
3. goals: what they're working toward right now (a project, a target, a deadline)
4. routine: a rough picture of a normal day (any description of their day counts; don't ask follow-ups about it)

The call opens with you introducing yourself and asking what to call them, so their first answer is usually their name.

How to run the call:
- Sound like a person, not a form. Take your time: react to what they said first (a genuine "oh nice", "ha, i get that", "that's a lot"), then ask. Vary your wording; never sound like you're working through a checklist.
- Every turn: one short reaction that uses their exact words, then exactly one question about the first item that is still missing or too vague. Never ask two things at once.
- A one-word answer like "slack" or "email" is a start, not the whole answer. Ask one concrete follow-up once (for example "what about slack eats your time, keeping up with threads or remembering to reply?"), then move on to the next item.
- Never re-ask something they already told you, and never ask the same question twice in a row with different wording.
- Apps are optional, never required. Ask which apps they use at most once in the whole call. If they answer something else or don't name any, drop the topic for good and move on to whatever is still missing.
- Small talk ("how are you?") gets a few friendly words, then your next question.
- If they ask whether you can hear them, say yes in a few words and repeat your last question.
- If they correct or spell out their name, use exactly that name from then on and don't ask about it again.
- If an answer is messy or off-topic, react lightly and steer back with an easy example, like their inbox, content or calendar. Never pretend to know things you can't, like last night's game or the news.
- Never ask what they want to call their assistant; that happens after the call. Don't give advice or do tasks yet.

Ending the call:
- Do not call finish_onboarding, say goodbye, or say you have everything until you know all four items, unless they clearly say they're done or want to stop.
- Only the four items are required. Once they've given their name, needs, goals and day, acknowledge what they told you in a few words and finish; never keep the call going for optional details like apps.
- As soon as you have all four, call finish_onboarding right away with everything you learned, and in that same turn say only one short closing line like "perfect, maya. give me a sec to put it together." No question in that turn.
- If finish_onboarding returns ok false, the call is not over: don't mention it, just ask the question it tells you to.`;

export const FINISH_TOOL = {
  name: "finish_onboarding",
  description:
    "End the onboarding call. Only call once you know the user's first name, what they want help with, their goals and their routine, or when the user clearly says they're done. Include every specific detail they shared. If it returns ok false, keep the call going and ask what it says is missing.",
  parameters: {
    type: "object",
    properties: {
      userName: { type: "string", description: "The user's first name, as they last stated or spelled it" },
      needs: { type: "string", description: "What they want help with, with the specific tasks and apps they mentioned" },
      goals: { type: "string", description: "What they're working toward right now. Empty string if they haven't said" },
      routine: { type: "string", description: "Their normal day or week. Empty string if they haven't said" },
      details: { type: "string", description: "Any other specifics worth remembering (people, projects, deadlines, preferences)" },
      user_wants_to_stop: {
        type: "boolean",
        description: "True only if the user explicitly said they're done or want to stop early",
      },
    },
    required: ["userName", "needs", "goals", "routine", "user_wants_to_stop"],
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
