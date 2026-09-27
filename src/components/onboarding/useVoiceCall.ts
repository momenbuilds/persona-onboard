"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { fetchVoiceSession, transcribe } from "@/lib/api";
import { AGENT_OPENER, finishEarly, INTRO, initialEngine, OPENER, respond, resumeTurn, type EngineState } from "@/lib/conversation/engine";
import { reviewFinish } from "@/lib/conversation/finish-gate";
import { SAMPLE_ANSWER } from "@/lib/conversation/samples";
import type { ChatMessage } from "@/lib/schema";
import { MIC_ALIVE_RMS, VoiceAgentSession } from "@/lib/voice/agent-client";
import { createLevelSource } from "@/lib/voice/level";
import { releasePrimedAudio } from "@/lib/voice/prime";
import { MicError, MicRecorder } from "@/lib/voice/recorder";
import { Speaker } from "@/lib/voice/speaker";
import { uid, type Action, type OnboardingState } from "./state";

export type CallStatus = "idle" | "connecting" | "speaking" | "listening" | "thinking" | "ended" | "error";

/**
 * "agent": AssemblyAI Voice Agent API — natural voice, streaming STT, real turn-taking.
 * "local": fallback when the agent can't connect (no key / network) — MediaRecorder →
 *          /api/transcribe, the on-device dialogue engine, and browser speech synthesis.
 */
export type CallBackend = "agent" | "local";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Options = {
  state: OnboardingState;
  dispatch: Dispatch<Action>;
  /** From /api/health — null while unknown. */
  transcriptionAvailable: boolean | null;
  voiceAvailable?: boolean | null;
};

function transcriptText(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.text.trim())
    .map((m) => `${m.role === "persona" ? "Persona" : "User"}: ${m.text.trim()}`)
    .join("\n");
}

/** Base prompt + everything said so far, so the agent never loses context (typing, reconnects). */
function promptWithContext(base: string, messages: ChatMessage[], resumed: boolean) {
  if (!messages.some((m) => m.role === "user")) return base;
  return `${base}

${resumed ? "This call dropped earlier and the user reconnected. " : ""}The conversation so far, oldest first (some of it was typed rather than spoken):
${transcriptText(messages).slice(-6000)}`;
}

/**
 * Runs the onboarding "phone call". Every async step captures a generation
 * number; hanging up, interrupting or retrying bumps it, so stale
 * continuations stop instead of racing.
 */
export function useVoiceCall({ state, dispatch, transcriptionAvailable, voiceAvailable = null }: Options) {
  const [status, setStatusState] = useState<CallStatus>(state.messages.length ? "ended" : "idle");
  const [backend, setBackend] = useState<CallBackend>("agent");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [micPaused, setMicPaused] = useState(false);
  /** "silent": the mic delivers digital silence; "lost": the device went away. */
  const [micIssue, setMicIssue] = useState<"silent" | "lost" | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [micLabel, setMicLabel] = useState<string | null>(null);

  const level = useMemo(() => createLevelSource(), []);
  const speaker = useMemo(() => new Speaker(), []);
  const mic = useMemo(() => new MicRecorder(), []);
  const agent = useRef<VoiceAgentSession | null>(null);
  const basePrompt = useRef("");

  const gen = useRef(0);
  const statusRef = useRef(status);
  const backendRef = useRef<CallBackend>("agent");
  const engineRef = useRef<EngineState>(state.engine);
  const modeRef = useRef(state.callMode);
  const messagesRef = useRef<ChatMessage[]>(state.messages);
  const lastBlob = useRef<Blob | null>(null);
  const sttRef = useRef(transcriptionAvailable);
  const voiceRef = useRef(voiceAvailable);
  const mutedRef = useRef(state.muted);
  // Agent wrap-up: finish_onboarding was called → end after the closing line plays.
  const finishing = useRef<{ closingReply: string | null; timer: ReturnType<typeof setTimeout> | null } | null>(null);

  useEffect(() => {
    messagesRef.current = state.messages;
  }, [state.messages]);
  useEffect(() => {
    sttRef.current = transcriptionAvailable;
    voiceRef.current = voiceAvailable;
  }, [transcriptionAvailable, voiceAvailable]);

  useEffect(() => {
    mutedRef.current = state.muted;
    speaker.muted = state.muted;
    if (state.muted) speaker.cancel();
    agent.current?.setVolume(state.muted ? 0 : 1);
  }, [state.muted, speaker]);

  // Release everything if the call screen unmounts.
  useEffect(
    () => () => {
      gen.current++;
      speaker.cancel();
      mic.close();
      agent.current?.end();
      agent.current = null;
    },
    [speaker, mic],
  );

  const alive = (g: number) => g === gen.current;

  // Dead-mic watchdog: while we're expecting the user to talk, a mic that sits at
  // digital silence for 4s isn't working (wrong device, Bluetooth still switching,
  // hardware mute). Tell the user instead of silently hearing nothing.
  useEffect(() => {
    const live = ["listening", "speaking", "thinking"].includes(status) && state.callMode === "voice" && !micPaused;
    if (!live || backend !== "agent") return;
    let silentSince: number | null = null;
    const t = setInterval(() => {
      const s = agent.current;
      if (!s?.micOn) return;
      const rms = s.rawInputRms();
      if (rms > MIC_ALIVE_RMS) {
        silentSince = null;
        setMicIssue((m) => (m === "silent" ? null : m));
      } else {
        silentSince ??= Date.now();
        if (Date.now() - silentSince > 4000) setMicIssue((m) => m ?? "silent");
      }
    }, 400);
    return () => clearInterval(t);
  }, [status, state.callMode, micPaused, backend]);

  function setStatus(next: CallStatus) {
    statusRef.current = next;
    setStatusState(next);
  }

  function setEngine(engine: EngineState) {
    engineRef.current = engine;
    dispatch({ type: "setEngine", engine });
  }

  function setMode(mode: "voice" | "text") {
    modeRef.current = mode;
    dispatch({ type: "setMode", mode });
  }

  function switchBackend(next: CallBackend) {
    backendRef.current = next;
    setBackend(next);
  }

  function upsert(message: ChatMessage) {
    const i = messagesRef.current.findIndex((m) => m.id === message.id);
    messagesRef.current =
      i === -1 ? [...messagesRef.current, message] : messagesRef.current.map((m, j) => (j === i ? message : m));
    dispatch({ type: "upsertMessage", message });
  }

  function addMessage(role: ChatMessage["role"], text: string, via?: ChatMessage["via"]) {
    upsert({ id: uid(), role, text, via });
  }

  /** Keep the local engine's slots up to date (name, needs…) without letting it drive the agent. */
  function track(text: string) {
    const turn = respond(engineRef.current, text);
    setEngine({ ...turn.state, done: engineRef.current.done });
  }

  /* ---------------------------------------------------------------- */
  /* Agent backend                                                     */
  /* ---------------------------------------------------------------- */

  function listenLevel() {
    const s = agent.current;
    level.set(s && modeRef.current === "voice" && s.micOn ? s.getInputLevel : null);
  }

  function refreshAgentContext(resumed = false) {
    agent.current?.setSystemPrompt(promptWithContext(basePrompt.current, messagesRef.current, resumed));
  }

  function wrapUp(g: number) {
    if (!alive(g)) return;
    gen.current++;
    if (finishing.current?.timer) clearTimeout(finishing.current.timer);
    finishing.current = null;
    agent.current?.end();
    agent.current = null;
    speaker.cancel();
    mic.close();
    level.set(null);
    setStatus("ended");
  }

  function beginFinish(g: number, userName?: string) {
    const name = typeof userName === "string" ? userName.trim().split(/\s+/)[0] : "";
    const e = engineRef.current;
    setEngine({
      ...e,
      done: true,
      slots: { ...e.slots, name: name ? name[0].toUpperCase() + name.slice(1) : e.slots.name },
    });
    if (finishing.current) return;
    finishing.current = { closingReply: null, timer: null };
    // Safety net: wrap up even if the closing line never arrives.
    finishing.current.timer = setTimeout(() => wrapUp(g), 7000);
  }

  async function startAgent(mode: "voice" | "text", g: number): Promise<boolean> {
    const session = await fetchVoiceSession();
    if (!alive(g) || !session.ok) return false;
    basePrompt.current = session.systemPrompt;

    const s = new VoiceAgentSession({
      onReplyStarted: (id) => {
        if (!alive(g)) return;
        if (finishing.current && !finishing.current.closingReply) finishing.current.closingReply = id;
        setStatus("speaking");
        level.set(s.getOutputLevel);
      },
      onAgentDelta: (id, text) => alive(g) && upsert({ id: `a-${id}`, role: "persona", text }),
      onAgentFinal: (id, text) => {
        if (!alive(g) || !text.trim()) return;
        upsert({ id: `a-${id}`, role: "persona", text: text.trim() });
      },
      onReplyPlayed: (id) => {
        if (!alive(g)) return;
        if (finishing.current?.closingReply === id) return wrapUp(g);
        if (finishing.current) return; // tool-call turn; the closing line is next
        refreshAgentContext();
        setStatus("listening");
        listenLevel();
      },
      onUserSpeechStarted: () => {
        if (!alive(g)) return;
        setStatus("listening");
        listenLevel();
      },
      onUserDelta: (id, text) => {
        if (!alive(g) || !text.trim()) return;
        setStatus("listening");
        upsert({ id: `u-${id}`, role: "user", text, via: "voice" });
      },
      onUserFinal: (id, text) => {
        if (!alive(g) || !text.trim()) return;
        upsert({ id: `u-${id}`, role: "user", text: text.trim(), via: "voice" });
        track(text);
        setStatus("thinking");
        level.set(null);
      },
      onToolCall: (name, args) => {
        if (!alive(g) || name !== "finish_onboarding") return;
        // finish() sets `finishing` before asking the agent to wrap up, so a user-requested
        // stop always goes through; otherwise the agent keeps asking until it has everything.
        const decision = reviewFinish(args, finishing.current !== null);
        if (!decision.accept) {
          console.info("[voice] finish rejected, still missing:", decision.missing.join(", "));
          return decision.result;
        }
        const notes = Object.fromEntries(
          Object.entries(args).filter(([, v]) => typeof v === "string" && v.trim()).map(([k, v]) => [k, String(v).trim()]),
        );
        dispatch({ type: "setNotes", notes });
        beginFinish(g, typeof args.userName === "string" ? args.userName : undefined);
      },
      onMicLost: () => {
        if (alive(g)) setMicIssue("lost");
      },
      onAudioState: (running) => {
        if (alive(g)) setAudioBlocked(!running);
      },
      onEnded: () => {
        if (!alive(g)) return;
        gen.current++;
        agent.current = null;
        level.set(null);
        setStatus("ended");
      },
      onError: () => {
        if (!alive(g)) return;
        gen.current++;
        agent.current = null;
        level.set(null);
        setError("the call dropped. your transcript is safe.");
        setStatus("error");
      },
    });

    try {
      await s.connect({ session: session.session, token: session.token });
    } catch {
      s.end();
      return false;
    }
    if (!alive(g)) {
      s.end();
      return true;
    }
    agent.current = s;
    switchBackend("agent");
    s.setVolume(mutedRef.current ? 0 : 1);

    setAudioBlocked(!s.audioRunning);
    if (mode === "voice") {
      try {
        await s.startMic();
        setMicPaused(false);
        setMicLabel(s.micDevice?.label ?? null);
        // Don't ask the first question until the mic actually delivers audio,
        // or the user's first answer is lost while the device wakes up.
        const live = await s.waitForMicSignal(3000);
        if (!alive(g)) return true;
        setMicIssue(live ? null : "silent");
      } catch (e) {
        if (!alive(g)) return true;
        const kind = e instanceof MicError ? e.kind : "unavailable";
        setMode("text");
        setNotice(
          kind === "denied"
            ? "no mic access? no problem. type your answers and Persona will still talk to you."
            : "couldn't find a microphone, so type your answers. Persona will still talk to you.",
        );
      }
    }
    if (!alive(g)) return true;

    const hasHistory = messagesRef.current.some((m) => m.role === "user");
    refreshAgentContext(hasHistory);
    if (hasHistory) {
      s.reply(
        engineRef.current.done
          ? "Welcome them back in a few words and ask if there's anything else they want you to know before you put it together."
          : "Welcome them back in a few words, then continue with whatever is still missing. Don't repeat questions they already answered.",
      );
    } else {
      // A beat of quiet after connecting, like a person picking up, then the intro.
      await delay(700);
      if (!alive(g)) return true;
      s.reply(`Say exactly this and nothing else: "${AGENT_OPENER}"`);
    }
    return true;
  }

  /** A typed (or sample) answer, sent to the agent with the full transcript as context. */
  function agentTyped(text: string, via: ChatMessage["via"]) {
    const s = agent.current;
    if (!s) return;
    addMessage("user", text, via);
    track(text);
    setStatus("thinking");
    level.set(null);
    refreshAgentContext();
    s.reply(`The user typed this instead of speaking: "${text.replace(/"/g, "'")}". Respond to it, following your instructions and the conversation so far.`);
  }

  /* ---------------------------------------------------------------- */
  /* Local backend (fallback)                                          */
  /* ---------------------------------------------------------------- */

  async function personaSays(text: string, g: number) {
    addMessage("persona", text);
    setStatus("speaking");
    level.set(speaker.getLevel);
    await speaker.speak(text);
    if (!alive(g)) return false;
    level.set(null);
    return true;
  }

  function listenLocal(g: number) {
    if (!alive(g)) return;
    setStatus("listening");
    if (modeRef.current === "voice" && mic.isOpen) {
      level.set(mic.getLevel);
      try {
        mic.start(() => void endVoiceTurn());
      } catch {
        switchLocalToText("lost the microphone, so let's type instead.");
      }
    } else {
      level.set(null);
    }
  }

  function wrapUpLocal(g: number) {
    if (!alive(g)) return;
    gen.current++;
    mic.close();
    level.set(null);
    setStatus("ended");
  }

  async function userTurnLocal(text: string, via: ChatMessage["via"], g: number) {
    addMessage("user", text, via);
    setStatus("thinking");
    level.set(null);
    const turn = respond(engineRef.current, text);
    setEngine(turn.state);
    await delay(450 + Math.min(650, text.length * 3));
    if (!alive(g)) return;
    if (!(await personaSays(turn.reply, g))) return;
    if (turn.state.done) wrapUpLocal(g);
    else listenLocal(g);
  }

  async function transcribeTurn(blob: Blob, g: number) {
    setError(null);
    setStatus("thinking");
    const result = await transcribe(blob);
    if (!alive(g)) return;
    if (!result.ok) {
      if (result.code === "NO_KEY") {
        switchLocalToText("voice transcription isn't set up on this server, so type your answer and i'll keep going.");
        setStatus("listening");
        return;
      }
      setError(result.message);
      setStatus("error");
      return;
    }
    if (!result.text) {
      if (await personaSays("hmm, i didn't catch that. mind saying it again?", g)) listenLocal(g);
      return;
    }
    await userTurnLocal(result.text, "voice", g);
  }

  async function endVoiceTurn() {
    const g = gen.current;
    if (backendRef.current !== "local" || statusRef.current !== "listening" || modeRef.current !== "voice") return;
    setStatus("thinking");
    level.set(null);
    const blob = await mic.stop();
    if (!alive(g)) return;
    if (!blob) {
      if (await personaSays("sorry, i didn't catch that. mind saying it again?", g)) listenLocal(g);
      return;
    }
    lastBlob.current = blob;
    await transcribeTurn(blob, g);
  }

  function switchLocalToText(message?: string) {
    setMode("text");
    mic.close();
    level.set(null);
    if (message) setNotice(message);
  }

  async function startLocal(mode: "voice" | "text", g: number) {
    switchBackend("local");
    releasePrimedAudio();
    if (mode === "voice") {
      if (sttRef.current === false) {
        setMode("text");
        setNotice("voice transcription isn't configured here, so you'll type. Persona will still talk to you.");
      } else {
        try {
          await mic.open();
        } catch (e) {
          if (!alive(g)) return;
          const kind = e instanceof MicError ? e.kind : "unavailable";
          setMode("text");
          setNotice(
            kind === "denied" ? "no mic access? no problem, let's type instead." : "couldn't find a microphone, so let's type instead.",
          );
        }
      }
    }
    if (!alive(g)) return;
    await delay(500);
    if (!alive(g)) return;
    if (engineRef.current.done) return wrapUpLocal(g);
    let line = `${INTRO} ${OPENER}`;
    if (messagesRef.current.length > 0) {
      const turn = resumeTurn(engineRef.current);
      setEngine(turn.state);
      line = turn.reply;
    }
    if (await personaSays(line, g)) listenLocal(g);
  }

  /* ---------------------------------------------------------------- */
  /* Public controls                                                   */
  /* ---------------------------------------------------------------- */

  /** Start a new call, or reconnect after a hang-up (the transcript is kept). */
  async function start(mode: "voice" | "text") {
    const g = ++gen.current;
    agent.current?.end();
    agent.current = null;
    mic.close();
    finishing.current = null;
    setError(null);
    setNotice(null);
    setMicIssue(null);
    setMode(mode);
    setStatus("connecting");
    setStartedAt(Date.now());
    // Nothing was said yet (e.g. the mic failed last time): start clean, one opener.
    if (!messagesRef.current.some((m) => m.role === "user") && messagesRef.current.length) {
      messagesRef.current = [];
      engineRef.current = initialEngine();
      dispatch({ type: "clearTranscript" });
    }
    if (engineRef.current.done && messagesRef.current.some((m) => m.role === "user")) {
      // Reopened to add something: let the conversation continue.
      setEngine({ ...engineRef.current, done: false });
    }

    if (voiceRef.current !== false && (await startAgent(mode, g))) return;
    if (!alive(g)) return;
    await startLocal(mode, g);
  }

  function hangUp() {
    gen.current++;
    if (finishing.current?.timer) clearTimeout(finishing.current.timer);
    finishing.current = null;
    agent.current?.end();
    agent.current = null;
    speaker.cancel();
    mic.close();
    level.set(null);
    setError(null);
    setStatus("ended");
  }

  const canSend = () => ["listening", "speaking", "thinking", "error"].includes(statusRef.current);

  function sendText(raw: string) {
    const text = raw.trim().slice(0, 1200);
    if (!text || !canSend()) return false;
    if (backendRef.current === "agent" && agent.current) {
      agentTyped(text, "text");
      return true;
    }
    const g = ++gen.current;
    speaker.cancel();
    mic.discard();
    setError(null);
    void userTurnLocal(text, "text", g);
    return true;
  }

  function sendSample() {
    if (!canSend()) return;
    if (backendRef.current === "agent" && agent.current) return agentTyped(SAMPLE_ANSWER, "sample");
    const g = ++gen.current;
    speaker.cancel();
    mic.discard();
    void userTurnLocal(SAMPLE_ANSWER, "sample", g);
  }

  function finish() {
    if (backendRef.current === "agent" && agent.current) {
      const g = gen.current;
      beginFinish(g);
      setStatus("thinking");
      agent.current.reply(
        `The user says that's everything for now. Call finish_onboarding with what you know, then say one short closing line like "got it${engineRef.current.slots.name ? `, ${engineRef.current.slots.name.toLowerCase()}` : ""}. that's plenty to start with."`,
      );
      return;
    }
    const g = ++gen.current;
    speaker.cancel();
    mic.discard();
    const turn = finishEarly(engineRef.current);
    setEngine(turn.state);
    void personaSays(turn.reply, g).then((ok) => ok && wrapUpLocal(g));
  }

  function retry() {
    if (backendRef.current === "agent") {
      void start(modeRef.current);
      return;
    }
    const g = ++gen.current;
    speaker.cancel();
    mic.discard();
    setError(null);
    if (lastBlob.current) void transcribeTurn(lastBlob.current, g);
    else listenLocal(g);
  }

  async function switchToVoice() {
    if (backendRef.current === "agent" && agent.current) {
      try {
        await agent.current.startMic();
      } catch (e) {
        const kind = e instanceof MicError ? e.kind : "unavailable";
        setNotice(kind === "denied" ? "the mic is blocked in your browser settings, so typing it is." : "no microphone found.");
        return;
      }
      setNotice(null);
      setMicPaused(false);
      setMode("voice");
      if (statusRef.current === "listening") listenLevel();
      return;
    }
    try {
      await mic.open();
    } catch (e) {
      const kind = e instanceof MicError ? e.kind : "unavailable";
      setNotice(kind === "denied" ? "the mic is blocked in your browser settings, so typing it is." : "no microphone found.");
      return;
    }
    setNotice(null);
    setMode("voice");
    if (statusRef.current === "listening") {
      const g = ++gen.current;
      speaker.cancel();
      listenLocal(g);
    }
  }

  function switchToText() {
    if (backendRef.current === "agent") {
      agent.current?.stopMic();
      setMode("text");
      if (statusRef.current === "listening") level.set(null);
    } else {
      switchLocalToText();
    }
    if (statusRef.current === "error" && backendRef.current === "local") {
      setError(null);
      setStatus("listening");
    }
  }

  async function resumeAudio() {
    const running = (await agent.current?.resumeAudio()) ?? true;
    setAudioBlocked(!running);
  }

  async function listMics(): Promise<{ id: string; label: string }[]> {
    const devices = await navigator.mediaDevices?.enumerateDevices?.().catch(() => []) ?? [];
    return devices
      .filter((d) => d.kind === "audioinput" && d.deviceId !== "default" && d.deviceId !== "communications")
      .map((d, i) => ({ id: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
  }

  /** Switch the call to another input device without hanging up. */
  async function chooseMic(deviceId: string) {
    const s = agent.current;
    if (!s) return;
    try {
      await s.startMic(deviceId);
      setMicLabel(s.micDevice?.label ?? null);
      setMicPaused(false);
      setMode("voice");
      if (statusRef.current === "listening") listenLevel();
      const live = await s.waitForMicSignal(2500);
      setMicIssue(live ? null : "silent");
    } catch {
      setMicIssue("lost");
    }
  }

  function toggleMicPaused() {
    const next = !micPaused;
    agent.current?.setMicPaused(next);
    setMicPaused(next);
    if (statusRef.current === "listening") listenLevel();
  }

  return {
    status,
    backend,
    mode: state.callMode,
    notice,
    dismissNotice: () => setNotice(null),
    error,
    startedAt,
    level,
    micPaused,
    micIssue,
    dismissMicIssue: () => setMicIssue(null),
    micLabel,
    audioBlocked,
    resumeAudio,
    listMics,
    chooseMic,
    start,
    hangUp,
    resume: () => start(modeRef.current),
    resumeTyping: () => start("text"),
    sendText,
    sendSample,
    finish,
    retry,
    /** Local backend only: end the current answer now (the agent detects turns itself). */
    doneSpeaking: () => void endVoiceTurn(),
    toggleMicPaused,
    switchToText,
    switchToVoice,
    micSupported: MicRecorder.supported,
  };
}

export type VoiceCall = ReturnType<typeof useVoiceCall>;
