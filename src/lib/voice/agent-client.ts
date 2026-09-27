/**
 * Browser client for the AssemblyAI Voice Agent API.
 *
 * One WebSocket carries everything: mic audio up (PCM16 @ 24 kHz), the agent's
 * voice down (PCM16 @ 24 kHz), live transcripts both ways, and tool calls.
 *
 * The socket lives in a dedicated worker (public/voice/agent-worker.js) and the
 * mic worklet posts straight to it, so mic audio goes audio thread → worker →
 * network without ever waiting on the main thread. A janky UI used to delay
 * chunks, which the server hears as gaps: chopped words and false barge-ins.
 *
 * Playback is scheduled gaplessly on a Web Audio clock and flushed on barge-in.
 * Docs: https://www.assemblyai.com/docs/voice-agents/voice-agent-api/browser-integration
 */
import { MIC_CONSTRAINTS, takePrimedAudio } from "./prime";
import { MicError } from "./recorder";

const WS_URL = "wss://agents.assemblyai.com/v1/ws";
const RATE = 24_000;

export type AgentEvents = {
  onReady?: () => void;
  /** Agent started a reply (audio will follow). */
  onReplyStarted?: (replyId: string) => void;
  /** Word-by-word caption of the agent, in sync with playback. */
  onAgentDelta?: (replyId: string, textSoFar: string) => void;
  onAgentFinal?: (replyId: string, text: string, interrupted: boolean) => void;
  /** Reply finished generating AND its audio finished playing. */
  onReplyPlayed?: (replyId: string, status: "completed" | "interrupted") => void;
  onUserSpeechStarted?: () => void;
  onUserDelta?: (itemId: string, textSoFar: string) => void;
  onUserFinal?: (itemId: string, text: string) => void;
  /** Return value is sent back as the tool.result (defaults to { ok: true }). */
  onToolCall?: (name: string, args: Record<string, unknown>) => Record<string, unknown> | void;
  /** Session ended cleanly (session.ended). */
  onEnded?: () => void;
  /** Connection problem before or during the session. */
  onError?: (message: string, retryable: boolean) => void;
  /** The browser suspended/resumed audio output. */
  onAudioState?: (running: boolean) => void;
  /** The microphone track ended (device unplugged or revoked). */
  onMicLost?: () => void;
};

/** Below this RMS the input is digital silence — the mic isn't actually delivering audio. */
export const MIC_ALIVE_RMS = 0.0004;

function rms(analyser: AnalyserNode | null, buf: Uint8Array<ArrayBuffer> | null) {
  if (!analyser || !buf) return 0;
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / buf.length) * 4.5);
}

export class VoiceAgentSession {
  private worker: Worker | null = null;
  private socketOpen = false;
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private outAnalyser: AnalyserNode | null = null;
  private outBuf: Uint8Array<ArrayBuffer> | null = null;
  private inAnalyser: AnalyserNode | null = null;
  private inBuf: Uint8Array<ArrayBuffer> | null = null;
  private stream: MediaStream | null = null;
  private worklet: AudioWorkletNode | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private playhead = 0;
  private ready = false;
  private ended = false;
  private micLive = false;
  private captions = new Map<string, string>();
  /** reply_id → { done, status } so "played" fires when both generation and audio finish. */
  private pending = new Map<string, { done: boolean; status: "completed" | "interrupted"; lastEnd: number }>();
  private currentReply: string | null = null;
  private toolCalls: { call_id: string; result: Record<string, unknown> }[] = [];
  private pageHide = () => this.end();

  constructor(private events: AgentEvents) {}

  private primedStream: Promise<MediaStream> | null = null;
  private workletLoaded = false;
  private deviceId: string | null = null;

  /** Uses the AudioContext/mic primed in the user's click (see prime.ts) when available. */
  async connect({ session, token }: { session: Record<string, unknown>; token: string }) {
    const primed = takePrimedAudio();
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = primed?.ctx ?? new Ctx();
    this.primedStream = primed?.stream ?? null;
    this.ctx.onstatechange = () => this.events.onAudioState?.(this.ctx?.state === "running");
    await this.ctx.resume().catch(() => {});
    this.out = this.ctx.createGain();
    this.outAnalyser = this.ctx.createAnalyser();
    this.outAnalyser.fftSize = 512;
    this.outBuf = new Uint8Array(new ArrayBuffer(this.outAnalyser.fftSize));
    this.out.connect(this.outAnalyser).connect(this.ctx.destination);
    this.playhead = this.ctx.currentTime;

    await new Promise<void>((resolve, reject) => {
      const worker = new Worker("/voice/agent-worker.js");
      this.worker = worker;
      let opened = false;
      worker.onmessage = (e: MessageEvent<Record<string, unknown> & { type: string }>) => {
        const msg = e.data;
        switch (msg.type) {
          case "ws.open":
            opened = true;
            this.socketOpen = true;
            return;
          case "ws.error":
            if (!this.ready) reject(new Error("voice agent connection failed"));
            return;
          case "ws.close":
            this.socketOpen = false;
            if (!this.ready) reject(new Error(opened ? `voice agent closed (${msg.code})` : "voice agent unreachable"));
            else if (!this.ended) this.events.onError?.("the call dropped", true);
            this.teardown();
            return;
          case "session.ready":
            resolve();
            break;
        }
        this.handle(msg);
      };
      worker.onerror = () => {
        if (!this.ready) reject(new Error("voice worker failed to start"));
      };
      worker.postMessage({ type: "connect", url: `${WS_URL}?token=${encodeURIComponent(token)}`, session });
    });
    window.addEventListener("pagehide", this.pageHide);
  }

  private setLive(live: boolean) {
    this.micLive = live;
    this.worker?.postMessage({ type: "mic", live });
  }

  /** Start streaming the microphone (optionally a specific device). Throws MicError (e.g. "denied"). */
  async startMic(deviceId?: string) {
    if (!this.ctx) return;
    if (deviceId && deviceId !== this.deviceId) this.stopMic();
    if (!this.stream) {
      try {
        const primed = !deviceId ? this.primedStream : null;
        this.primedStream = null;
        this.stream =
          (primed ? await primed.catch(() => null) : null) ??
          (await navigator.mediaDevices.getUserMedia({
            audio: deviceId ? { ...MIC_CONSTRAINTS, deviceId: { exact: deviceId } } : MIC_CONSTRAINTS,
          }));
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        throw new MicError(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
      }
      const track = this.stream.getAudioTracks()[0];
      this.deviceId = track?.getSettings().deviceId ?? deviceId ?? null;
      // If the device disappears (headphones unplugged), tell the UI.
      track?.addEventListener("ended", () => this.events.onMicLost?.());
      if (!this.workletLoaded) {
        await this.ctx.audioWorklet.addModule("/voice/pcm-capture.js");
        this.workletLoaded = true;
      }
      await this.ctx.resume().catch(() => {});
      const source = this.ctx.createMediaStreamSource(this.stream);
      this.inAnalyser = this.ctx.createAnalyser();
      this.inAnalyser.fftSize = 512;
      this.inBuf = new Uint8Array(new ArrayBuffer(this.inAnalyser.fftSize));
      this.worklet = new AudioWorkletNode(this.ctx, "pcm-capture", {
        processorOptions: { inputSampleRate: this.ctx.sampleRate, targetSampleRate: RATE },
      });
      // Wire the worklet directly to the network worker (no main-thread hop).
      const channel = new MessageChannel();
      this.worklet.port.postMessage({ port: channel.port1 }, [channel.port1]);
      this.worker?.postMessage({ type: "pcm-port", port: channel.port2 }, [channel.port2]);
      source.connect(this.inAnalyser);
      source.connect(this.worklet);
    }
    this.setLive(true);
  }

  /** Stop sending mic audio (typing mode) and release the device. */
  stopMic() {
    this.setLive(false);
    this.worklet?.port.close();
    this.worklet?.disconnect();
    this.worklet = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.inAnalyser = null;
  }

  get micOn() {
    return this.micLive;
  }

  /** The active input device's id and label ("MacBook Pro Microphone"). */
  get micDevice() {
    const track = this.stream?.getAudioTracks()[0];
    return track ? { id: this.deviceId, label: track.label } : null;
  }

  /** Unscaled input RMS (0–1). A live mic never sits at digital zero; a dead one does. */
  rawInputRms() {
    if (!this.inAnalyser) return 0;
    // Float data: byte data can't resolve a quiet noise floor from true silence.
    const f = new Float32Array(this.inAnalyser.fftSize);
    this.inAnalyser.getFloatTimeDomainData(f);
    let sum = 0;
    for (let i = 0; i < f.length; i++) sum += f[i] * f[i];
    return Math.sqrt(sum / f.length);
  }

  /** Resolve true once the mic delivers real signal (not digital silence), false on timeout. */
  async waitForMicSignal(timeoutMs = 3000) {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      if (this.rawInputRms() > MIC_ALIVE_RMS) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }

  get audioRunning() {
    return this.ctx?.state === "running";
  }

  /** Call from a click if the browser suspended audio. */
  async resumeAudio() {
    await this.ctx?.resume().catch(() => {});
    return this.audioRunning;
  }

  /** Ask the agent to speak now, guided by a one-shot instruction. */
  reply(instructions: string) {
    this.send({ type: "reply.create", instructions });
  }

  /** Replace the system prompt mid-session (takes effect on the next turn). */
  setSystemPrompt(systemPrompt: string) {
    this.send({ type: "session.update", session: { system_prompt: systemPrompt } });
  }

  /** Keep the mic open but stop sending audio (mute), or resume sending. */
  setMicPaused(paused: boolean) {
    if (this.stream) this.setLive(!paused);
  }

  setVolume(volume01: number) {
    if (this.out) this.out.gain.value = volume01;
  }

  getOutputLevel = () => rms(this.outAnalyser, this.outBuf);
  getInputLevel = () => (this.micLive ? rms(this.inAnalyser, this.inBuf) : 0);

  /** Hang up cleanly (stops billing immediately; no 30s resume window). */
  end() {
    if (this.ended) return;
    this.ended = true;
    if (this.socketOpen) {
      this.send({ type: "session.end" });
      setTimeout(() => this.teardown(), 1500);
    } else this.teardown();
  }

  private send(msg: object) {
    this.worker?.postMessage({ type: "send", msg });
  }

  private flushPlayback() {
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {}
    });
    this.sources.clear();
    if (this.ctx) this.playhead = this.ctx.currentTime;
  }

  private play(samples: Float32Array, replyId: string | null) {
    if (!this.ctx || !this.out || !samples.length) return;
    const buffer = this.ctx.createBuffer(1, samples.length, RATE);
    buffer.getChannelData(0).set(samples);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.out);
    const startAt = Math.max(this.playhead, this.ctx.currentTime + 0.02);
    src.start(startAt);
    this.playhead = startAt + buffer.duration;
    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
      if (replyId) this.maybePlayed(replyId);
    };
    if (replyId) {
      const p = this.pending.get(replyId);
      if (p) p.lastEnd = this.playhead;
    }
  }

  private maybePlayed(replyId: string) {
    const p = this.pending.get(replyId);
    if (!p || !p.done || !this.ctx) return;
    if (p.status === "completed" && this.ctx.currentTime < p.lastEnd - 0.01) return;
    this.pending.delete(replyId);
    this.events.onReplyPlayed?.(replyId, p.status);
  }

  private handle(msg: Record<string, unknown> & { type: string }) {
    switch (msg.type) {
      case "session.ready":
        this.ready = true;
        this.events.onReady?.();
        break;
      case "reply.started": {
        const id = String(msg.reply_id);
        this.currentReply = id;
        this.captions.set(id, "");
        this.pending.set(id, { done: false, status: "completed", lastEnd: this.ctx?.currentTime ?? 0 });
        this.events.onReplyStarted?.(id);
        break;
      }
      case "reply.audio":
        // Decoded to Float32 in the worker.
        if (msg.samples instanceof Float32Array) this.play(msg.samples, this.currentReply);
        break;
      case "transcript.agent.delta": {
        const id = String(msg.reply_id);
        const text = `${this.captions.get(id) ?? ""}${this.captions.get(id) ? " " : ""}${String(msg.delta ?? "").trim()}`;
        this.captions.set(id, text);
        this.events.onAgentDelta?.(id, text);
        break;
      }
      case "transcript.agent":
        this.events.onAgentFinal?.(String(msg.reply_id), String(msg.text ?? ""), !!msg.interrupted);
        break;
      case "reply.done": {
        const id = String(msg.reply_id);
        const status = msg.status === "interrupted" ? "interrupted" : "completed";
        if (status === "interrupted") this.flushPlayback();
        const p = this.pending.get(id) ?? { done: false, status, lastEnd: 0 };
        p.done = true;
        p.status = status;
        this.pending.set(id, p);
        if (this.currentReply === id) this.currentReply = null;
        // Tool results must be sent right after reply.done.
        for (const call of this.toolCalls.splice(0)) {
          this.send({ type: "tool.result", call_id: call.call_id, result: JSON.stringify(call.result) });
        }
        this.maybePlayed(id);
        break;
      }
      case "input.speech.started":
        this.events.onUserSpeechStarted?.();
        break;
      case "transcript.user.delta":
        this.events.onUserDelta?.(String(msg.item_id), String(msg.text ?? ""));
        break;
      case "transcript.user":
        this.events.onUserFinal?.(String(msg.item_id), String(msg.text ?? ""));
        break;
      case "tool.call":
        const result = this.events.onToolCall?.(String(msg.name), (msg.arguments as Record<string, unknown>) ?? {});
        this.toolCalls.push({ call_id: String(msg.call_id), result: result ?? { ok: true } });
        break;
      case "session.ended":
        this.ended = true;
        this.events.onEnded?.();
        this.teardown();
        break;
      case "session.error": {
        const code = String(msg.code ?? "");
        const fatal = !["invalid_format", "invalid_audio", "invalid_value", "immutable_field", "invalid_config"].includes(code);
        if (fatal) this.events.onError?.(String(msg.message ?? code), ["at_capacity", "concurrency_exceeded", "internal_error"].includes(code));
        else console.warn("[voice-agent]", code, msg.message);
        break;
      }
    }
  }

  private teardown() {
    window.removeEventListener("pagehide", this.pageHide);
    this.flushPlayback();
    this.stopMic();
    const worker = this.worker;
    this.worker = null;
    this.socketOpen = false;
    if (worker) {
      worker.postMessage({ type: "close" });
      setTimeout(() => worker.terminate(), 500);
    }
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
