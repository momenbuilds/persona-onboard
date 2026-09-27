/**
 * A swappable 0–1 audio level source. The orb and waveform read it every
 * animation frame; the call controller points it at the mic (listening)
 * or the speaker (speaking). Kept outside React state to avoid 60fps renders.
 */
export type LevelSource = { get: () => number };

export type MutableLevelSource = LevelSource & { set: (fn: (() => number) | null) => void };

export function createLevelSource(): MutableLevelSource {
  let fn: (() => number) | null = null;
  return {
    get: () => {
      if (!fn) return 0;
      const v = fn();
      return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
    },
    set: (next) => {
      fn = next;
    },
  };
}

/** A synthetic "someone is talking" level for demos and muted playback. */
export function syntheticSpeech(seed = 0): () => number {
  return () => {
    const t = performance.now() / 1000 + seed;
    const syllables = Math.abs(Math.sin(t * 8.7)) * Math.abs(Math.sin(t * 2.3 + 1.1));
    const phrase = 0.55 + 0.45 * Math.sin(t * 0.9);
    return 0.18 + 0.62 * syllables * phrase;
  };
}
