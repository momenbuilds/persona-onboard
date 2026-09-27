import { syntheticSpeech } from "./level";

/**
 * Persona's voice: browser speech synthesis (no key needed).
 * When muted or unsupported it still "speaks" for a natural duration so the
 * call keeps its rhythm and the orb animates — the text is always on screen.
 */
const PREFERRED_VOICES = [
  "Samantha",
  "Ava (Premium)",
  "Ava (Enhanced)",
  "Ava",
  "Allison",
  "Google US English",
  "Microsoft Aria Online (Natural) - English (United States)",
  "Microsoft Jenny Online (Natural) - English (United States)",
];

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  for (const name of PREFERRED_VOICES) {
    const v = voices.find((voice) => voice.name === name);
    if (v) return v;
  }
  return voices.find((v) => v.lang === "en-US") ?? voices.find((v) => v.lang.startsWith("en"));
}

function readingTime(text: string) {
  const words = text.trim().split(/\s+/).length;
  return Math.min(9000, Math.max(900, words * 260));
}

export class Speaker {
  private pulse = 0;
  private active = false;
  private synthetic = syntheticSpeech();
  private cancelCurrent: (() => void) | null = null;
  muted = false;

  get supported() {
    return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  }

  /** Current output level, 0–1. */
  getLevel = () => {
    if (!this.active) return 0;
    this.pulse *= 0.86;
    return Math.min(1, this.synthetic() * 0.85 + this.pulse);
  };

  cancel() {
    this.cancelCurrent?.();
    this.cancelCurrent = null;
    this.active = false;
    if (this.supported) window.speechSynthesis.cancel();
  }

  /** Resolves when speech finishes (or is cancelled). Never rejects. */
  speak(text: string): Promise<void> {
    this.cancel();
    this.active = true;

    return new Promise<void>((resolve) => {
      let settled = false;
      let safety: ReturnType<typeof setTimeout> | undefined;
      const done = () => {
        if (settled) return;
        settled = true;
        this.active = false;
        clearTimeout(safety);
        resolve();
      };
      this.cancelCurrent = done;

      if (this.muted || !this.supported) {
        safety = setTimeout(done, readingTime(text));
        return;
      }

      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = pickVoice();
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? "en-US";
      utterance.rate = 1.04;
      utterance.pitch = 1.02;
      utterance.onboundary = () => {
        this.pulse = 0.35;
      };
      utterance.onend = done;
      utterance.onerror = done;
      // Chrome occasionally never fires onend; don't let the call hang.
      safety = setTimeout(done, readingTime(text) * 2 + 2500);
      synth.speak(utterance);
    });
  }
}
