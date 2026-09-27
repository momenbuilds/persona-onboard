/**
 * Microphone capture for the onboarding call: MediaRecorder for the audio we
 * upload, plus an AnalyserNode for the live level and simple end-of-speech
 * detection (stop after ~1.4s of silence once the user has started talking).
 */
export type MicErrorKind = "denied" | "unavailable" | "unsupported";

export class MicError extends Error {
  constructor(public kind: MicErrorKind) {
    super(kind);
  }
}

const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

const SPEECH_LEVEL = 0.12;
const SILENCE_MS = 1400;
const NO_SPEECH_MS = 12_000;
const MAX_MS = 60_000;

export class MicRecorder {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private buffer: Uint8Array<ArrayBuffer> | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private vadTimer: ReturnType<typeof setInterval> | null = null;
  private opening: Promise<void> | null = null;
  private epoch = 0;

  static get supported() {
    return (
      typeof window !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof window.MediaRecorder !== "undefined"
    );
  }

  get isOpen() {
    return !!this.stream;
  }

  get isRecording() {
    return this.recorder?.state === "recording";
  }

  /** Ask for the mic. Concurrent calls share one request; a stream that arrives after close() is released. */
  open(): Promise<void> {
    if (this.stream) return Promise.resolve();
    if (this.opening) return this.opening;
    const epoch = this.epoch;
    this.opening = this.acquire(epoch).finally(() => {
      if (epoch === this.epoch) this.opening = null;
    });
    return this.opening;
  }

  private async acquire(epoch: number) {
    if (!MicRecorder.supported) throw new MicError("unsupported");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      throw new MicError(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
    }
    if (epoch !== this.epoch) {
      // The call was hung up while the permission prompt was open.
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.buffer = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
    source.connect(this.analyser);
  }

  /** Live input level, 0–1. */
  getLevel = () => {
    if (!this.analyser || !this.buffer) return 0;
    this.analyser.getByteTimeDomainData(this.buffer);
    let sum = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      const v = (this.buffer[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / this.buffer.length) * 5);
  };

  /** Start recording one answer. `onEnd` fires when the user stops talking. */
  start(onEnd: () => void) {
    if (!this.stream) throw new MicError("unavailable");
    void this.ctx?.resume();
    const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(250);

    const startedAt = Date.now();
    let heardSpeech = false;
    let lastLoud = startedAt;
    this.clearVad();
    this.vadTimer = setInterval(() => {
      const now = Date.now();
      if (this.getLevel() > SPEECH_LEVEL) {
        heardSpeech = true;
        lastLoud = now;
      }
      const silentTooLong = heardSpeech && now - lastLoud > SILENCE_MS;
      const nothingSaid = !heardSpeech && now - startedAt > NO_SPEECH_MS;
      if (silentTooLong || nothingSaid || now - startedAt > MAX_MS) {
        this.clearVad();
        onEnd();
      }
    }, 80);
  }

  /** Stop the current answer and return the recording. */
  stop(): Promise<Blob | null> {
    this.clearVad();
    const recorder = this.recorder;
    this.recorder = null;
    if (!recorder || recorder.state === "inactive") return Promise.resolve(null);
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: recorder.mimeType || "audio/webm" });
        this.chunks = [];
        resolve(blob.size > 0 ? blob : null);
      };
      recorder.stop();
    });
  }

  /** Drop the current answer without returning it. */
  discard() {
    void this.stop();
  }

  /** Release the microphone entirely (hang-up / leaving the call). */
  close() {
    this.epoch++;
    this.opening = null;
    this.discard();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.analyser = null;
    this.buffer = null;
  }

  private clearVad() {
    if (this.vadTimer) clearInterval(this.vadTimer);
    this.vadTimer = null;
  }
}
