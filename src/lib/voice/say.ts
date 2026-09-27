import { fetchVoiceSession } from "@/lib/api";
import { VoiceAgentSession } from "./agent-client";
import type { MutableLevelSource } from "./level";
import { Speaker } from "./speaker";

/**
 * Speak one line in Persona's natural voice (a short AssemblyAI voice-agent
 * session, no mic). Falls back to browser speech synthesis when the agent
 * isn't available. Never rejects.
 */
export function speakNatural(text: string, { muted, level }: { muted: boolean; level?: MutableLevelSource }) {
  let cancelled = false;
  const box: { session: VoiceAgentSession | null } = { session: null };
  const speaker = new Speaker();
  speaker.muted = muted;

  const done = (async () => {
    const res = await fetchVoiceSession();
    if (cancelled) return;
    if (res.ok) {
      const finished = new Promise<void>((resolve) => {
        const safety = setTimeout(resolve, 15_000);
        box.session = new VoiceAgentSession({
          onReplyPlayed: () => {
            clearTimeout(safety);
            resolve();
          },
          onError: () => resolve(),
          onEnded: () => resolve(),
        });
      });
      try {
        await box.session!.connect({ agentId: res.agentId, token: res.token });
        if (cancelled) return;
        box.session!.setVolume(muted ? 0 : 1);
        level?.set(box.session!.getOutputLevel);
        box.session!.reply(`Say exactly this and nothing else: "${text.replace(/"/g, "'")}"`);
        await finished;
        return;
      } catch {
        // fall through to the browser voice
      } finally {
        level?.set(null);
        box.session?.end();
      }
      if (cancelled) return;
    }
    level?.set(speaker.getLevel);
    await speaker.speak(text);
    level?.set(null);
  })();

  return {
    done,
    cancel() {
      cancelled = true;
      box.session?.end();
      speaker.cancel();
      level?.set(null);
    },
  };
}
