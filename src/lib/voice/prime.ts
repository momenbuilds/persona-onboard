/**
 * Start audio *inside the user's click*, before any network round-trip.
 *
 * Browsers only guarantee an AudioContext can run (and Safari only grants the
 * mic smoothly) when started from a user gesture. Asking for the mic here also
 * gives Bluetooth headsets time to switch into call mode, so the first thing
 * the user says isn't swallowed while the device wakes up.
 */
export const MIC_CONSTRAINTS: MediaTrackConstraints = {
  // Echo cancellation so the agent doesn't hear itself; noise suppression happens server-side.
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: true,
};

type Primed = { ctx: AudioContext; stream: Promise<MediaStream> | null };
let primed: Primed | null = null;

function newContext() {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new Ctx();
}

/** Call synchronously from a click handler. Safe to call repeatedly. */
export function primeCallAudio(withMic: boolean) {
  if (typeof window === "undefined") return;
  if (!primed || primed.ctx.state === "closed") primed = { ctx: newContext(), stream: null };
  void primed.ctx.resume().catch(() => {});
  if (withMic && !primed.stream && navigator.mediaDevices?.getUserMedia) {
    const p = navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
    p.catch(() => {
      if (primed?.stream === p) primed.stream = null;
    });
    primed.stream = p;
  }
}

/** Hand the primed context/stream to the call (once). */
export function takePrimedAudio(): Primed | null {
  const p = primed;
  primed = null;
  return p;
}

/** Release anything primed but unused (e.g. the call fell back to another path). */
export function releasePrimedAudio() {
  const p = takePrimedAudio();
  if (!p) return;
  void p.stream?.then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => {});
  void p.ctx.close().catch(() => {});
}
