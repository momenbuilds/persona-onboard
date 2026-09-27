"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type Dispatch } from "react";
import { PersonaOrb, type OrbState } from "@/components/orb/PersonaOrb";
import { Waveform } from "@/components/orb/Waveform";
import { Bubble, TypingBubble } from "@/components/ui/Bubble";
import { Button, IconButton } from "@/components/ui/Button";
import { Composer } from "@/components/ui/Composer";
import { ArrowRightIcon, CheckIcon, HangUpIcon, KeyboardIcon, MicIcon, MicOffIcon, PhoneIcon, RetryIcon } from "@/components/ui/icons";
import { finishEarly } from "@/lib/conversation/engine";
import { primeCallAudio } from "@/lib/voice/prime";
import type { Action, OnboardingState } from "../state";
import { useVoiceCall, type CallStatus, type VoiceCall } from "../useVoiceCall";
import { StepHeading } from "./StepHeading";

type Props = {
  state: OnboardingState;
  dispatch: Dispatch<Action>;
  transcriptionAvailable: boolean | null;
  voiceAvailable: boolean | null;
};

export function CallStep({ state, dispatch, transcriptionAvailable, voiceAvailable }: Props) {
  const call = useVoiceCall({ state, dispatch, transcriptionAvailable, voiceAvailable });
  const { status, mode } = call;
  const active = !["idle", "ended"].includes(status);
  const userTurns = state.messages.filter((m) => m.role === "user").length;

  // Auto-dial when the user asked for a call — once we know whether voice
  // transcription is available (or after 1.5s). A refresh mid-call lands on
  // the "call paused" card instead, with the transcript intact.
  const callRef = useRef(call);
  useEffect(() => {
    callRef.current = call;
  });
  const { dialPending, callMode } = state;
  useEffect(() => {
    if (!dialPending) return;
    const dial = () => {
      dispatch({ type: "dialed" });
      void callRef.current.start(callMode);
    };
    if (transcriptionAvailable !== null) {
      dial();
      return;
    }
    const t = setTimeout(dial, 1500);
    return () => clearTimeout(t);
  }, [dialPending, transcriptionAvailable, callMode, dispatch]);

  const orbState: OrbState =
    status === "listening" ? (mode === "voice" ? "listening" : "idle") : status === "error" ? "idle" : (status as OrbState);

  const canSend = ["listening", "speaking", "error"].includes(status);
  const canFinish =
    active && !state.engine.done && userTurns > 0 && (state.engine.slots.needs.length > 0 || !!state.engine.slots.name);

  return (
    <section className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-5 pt-6">
      <StepHeading className="sr-only">Quick call with Persona</StepHeading>

      <div className="flex justify-center">
        <StatusPill status={status} mode={mode} startedAt={call.startedAt} done={state.engine.done} />
      </div>

      <div className="flex flex-col items-center pt-7">
        <PersonaOrb state={orbState} level={call.level} size={124} />
        <div className="mt-5 flex h-10 w-44 items-center justify-center">
          {mode === "text" && status === "listening" ? (
            <p className="text-[13px] text-muted">your turn, type below</p>
          ) : call.backend === "agent" && mode === "voice" && status === "listening" && call.micPaused ? (
            <p className="text-[13px] text-muted">your mic is muted</p>
          ) : (
            <Waveform level={call.level} active={status === "listening" || status === "speaking"} height={40} bars={28} />
          )}
        </div>
      </div>

      <Transcript messages={state.messages} thinking={status === "thinking"} />

      <div className="sticky bottom-0 -mx-5 mt-auto bg-gradient-to-t from-white via-white/95 to-white/0 px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-6">
        <AnimatePresence>
          {call.notice ? (
            <Banner key="notice" onDismiss={call.dismissNotice}>
              {call.notice}
            </Banner>
          ) : null}
          {active && call.audioBlocked ? (
            <Banner key="audio" tone="error">
              <span>your browser paused Persona&apos;s sound.</span>
              <span className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => void call.resumeAudio()}>
                  Turn on sound
                </Button>
              </span>
            </Banner>
          ) : null}
          {active && mode === "voice" && call.micIssue ? (
            <Banner key="mic" tone="error" onDismiss={call.dismissMicIssue}>
              <span>
                {call.micIssue === "lost"
                  ? "your microphone disconnected."
                  : "i can't hear anything from your mic. check it's not muted, or pick another one."}
              </span>
              <span className="mt-2 flex flex-wrap items-center gap-2">
                <MicPicker call={call} />
                <Button size="sm" variant="glass" onClick={call.switchToText}>
                  Type instead
                </Button>
              </span>
            </Banner>
          ) : null}
          {status === "error" && call.error ? (
            <Banner key="error" tone="error">
              <span>{call.error.toLowerCase()} want to try again?</span>
              <span className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    primeCallAudio(mode === "voice");
                    call.retry();
                  }}
                >
                  <RetryIcon className="h-4 w-4" /> Retry
                </Button>
                <Button size="sm" variant="glass" onClick={call.switchToText}>
                  Type it instead
                </Button>
              </span>
            </Banner>
          ) : null}
        </AnimatePresence>

        {active ? (
          <ActiveControls call={call} canSend={canSend} canFinish={canFinish} showSample={userTurns === 0} transcriptionAvailable={transcriptionAvailable} />
        ) : status === "ended" ? (
          <EndedCard
            done={state.engine.done}
            hasAnswers={userTurns > 0}
            onSeeResults={() => dispatch({ type: "go", step: "understanding" })}
            onResume={() => {
              primeCallAudio(true);
              void call.resume();
            }}
            onResumeTyping={() => {
              primeCallAudio(false);
              void call.resumeTyping();
            }}
            onContinue={() => {
              dispatch({ type: "setEngine", engine: finishEarly(state.engine).state });
              dispatch({ type: "go", step: "understanding" });
            }}
          />
        ) : null}
      </div>
    </section>
  );
}

function ActiveControls({
  call,
  canSend,
  canFinish,
  showSample,
  transcriptionAvailable,
}: {
  call: VoiceCall;
  canSend: boolean;
  canFinish: boolean;
  showSample: boolean;
  transcriptionAvailable: boolean | null;
}) {
  const { status, mode } = call;
  const voiceAllowed = call.micSupported && (call.backend === "agent" || transcriptionAvailable !== false);

  return (
    <div className="flex flex-col gap-3">
      {(showSample && canSend) || canFinish ? (
        <div className="flex flex-wrap justify-center gap-2">
          {showSample && canSend ? (
            <Button size="sm" variant="glass" onClick={call.sendSample}>
              Use a sample answer
            </Button>
          ) : null}
          {canFinish ? (
            <Button size="sm" variant="glass" onClick={call.finish}>
              <CheckIcon className="h-4 w-4" /> That&apos;s everything
            </Button>
          ) : null}
        </div>
      ) : null}

      {mode === "text" ? (
        <Composer
          onSend={call.sendText}
          disabled={!canSend}
          autoFocus
          placeholder={canSend ? "type your answer…" : "Persona is thinking…"}
          label="Your answer"
        />
      ) : null}

      <div className={`flex items-center px-2 ${mode === "voice" ? "justify-between" : "justify-center gap-5"}`}>
        {mode === "voice" ? (
          <IconButton label="Type instead" className="h-14 w-14" onClick={call.switchToText}>
            <KeyboardIcon className="h-6 w-6" />
          </IconButton>
        ) : voiceAllowed ? (
          <IconButton label="Switch to voice" className="h-14 w-14" onClick={() => void call.switchToVoice()}>
            <MicIcon className="h-6 w-6" />
          </IconButton>
        ) : null}

        {mode === "voice" && call.backend === "agent" ? (
          <div className="flex flex-col items-center gap-1.5">
            <IconButton
              label={call.micPaused ? "Unmute microphone" : "Mute microphone"}
              aria-pressed={call.micPaused}
              variant={call.micPaused ? "ink" : "glass"}
              className="h-[68px] w-[68px]"
              onClick={call.toggleMicPaused}
            >
              {call.micPaused ? <MicOffIcon className="h-7 w-7" /> : <MicIcon className="h-7 w-7" />}
            </IconButton>
            <span className={`text-[12px] ${call.micPaused ? "font-medium text-ios-red" : "text-muted"}`} aria-hidden>
              {call.micPaused ? "muted · tap to unmute" : "you're live · tap to mute"}
            </span>
          </div>
        ) : mode === "voice" ? (
          <div className="flex flex-col items-center gap-1.5">
            <IconButton
              label="I'm done talking"
              variant={status === "listening" ? "ink" : "glass"}
              className="h-[68px] w-[68px]"
              disabled={status !== "listening"}
              onClick={call.doneSpeaking}
            >
              {status === "listening" ? <CheckIcon className="h-7 w-7" /> : <MicIcon className="h-7 w-7" />}
            </IconButton>
            <span className="text-[12px] text-muted" aria-hidden>
              {status === "listening" ? "tap when you're done" : " "}
            </span>
          </div>
        ) : null}

        <IconButton label="Hang up" variant="danger" className="h-14 w-14" onClick={call.hangUp}>
          <HangUpIcon className="h-6 w-6" />
        </IconButton>
      </div>

      {mode === "voice" && call.backend === "agent" && call.micLabel ? (
        <div className="flex justify-center">
          <MicPicker call={call} compact />
        </div>
      ) : null}
    </div>
  );
}

/** Choose the input device (e.g. switch from AirPods to the laptop mic) without hanging up. */
function MicPicker({ call, compact = false }: { call: VoiceCall; compact?: boolean }) {
  const [devices, setDevices] = useState<{ id: string; label: string }[]>([]);
  const { listMics } = call;
  useEffect(() => {
    void listMics().then(setDevices);
    const onChange = () => void listMics().then(setDevices);
    navigator.mediaDevices?.addEventListener?.("devicechange", onChange);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", onChange);
    // listMics only reads navigator.mediaDevices
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (devices.length === 0) return null;
  const current = devices.find((d) => d.label === call.micLabel)?.id ?? "";
  return (
    <label className={`inline-flex items-center gap-2 ${compact ? "text-[12px] text-faint" : "text-[13px] text-ink-soft"}`}>
      <span>{compact ? "mic:" : "microphone"}</span>
      <select
        value={current}
        onChange={(e) => void call.chooseMic(e.target.value)}
        className={`max-w-[220px] truncate rounded-full bg-transparent py-1 pr-1 outline-none focus-visible:ring-2 focus-visible:ring-ios-blue ${
          compact ? "text-faint hover:text-ink" : "liquid-glass px-3 text-ink"
        }`}
      >
        {!current ? <option value="">{call.micLabel ?? "choose…"}</option> : null}
        {devices.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EndedCard({
  done,
  hasAnswers,
  onSeeResults,
  onResume,
  onResumeTyping,
  onContinue,
}: {
  done: boolean;
  hasAnswers: boolean;
  onSeeResults: () => void;
  onResume: () => void;
  onResumeTyping: () => void;
  onContinue: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card flex flex-col items-center gap-3 rounded-[28px] px-5 py-6 text-center"
    >
      {done ? (
        <>
          <p className="text-[17px] font-medium tracking-[-0.01em]">that&apos;s everything i need.</p>
          <Button size="lg" className="w-full sm:w-auto" onClick={onSeeResults} autoFocus>
            See what I got <ArrowRightIcon className="h-5 w-5" />
          </Button>
        </>
      ) : (
        <>
          <div>
            <p className="text-[17px] font-medium tracking-[-0.01em]">call paused</p>
            <p className="mt-1 text-[14px] text-muted">your transcript is saved. pick up whenever you like.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={onResume}>
              <PhoneIcon className="h-5 w-5" /> Resume call
            </Button>
            <Button variant="glass" onClick={onResumeTyping}>
              <KeyboardIcon className="h-5 w-5" /> Resume by typing
            </Button>
          </div>
          {hasAnswers ? (
            <Button variant="ghost" size="sm" onClick={onContinue}>
              Continue with what I&apos;ve shared <ArrowRightIcon className="h-4 w-4" />
            </Button>
          ) : null}
        </>
      )}
    </motion.div>
  );
}

function Transcript({ messages, thinking }: { messages: OnboardingState["messages"]; thinking: boolean }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, thinking]);

  return (
    <div role="log" aria-live="polite" aria-label="Call transcript" className="mt-6 flex flex-col gap-2 pb-4">
      {messages.map((m, i) => (
        <Bubble key={m.id} from={m.role} tail={messages[i + 1]?.role !== m.role}>
          <span className="sr-only">{m.role === "persona" ? "Persona: " : "You: "}</span>
          {m.text}
        </Bubble>
      ))}
      <AnimatePresence>{thinking ? <TypingBubble key="typing" /> : null}</AnimatePresence>
      <div ref={end} className="scroll-mb-64" />
    </div>
  );
}

const LABELS: Record<CallStatus, string> = {
  idle: "ready",
  connecting: "connecting…",
  speaking: "Persona is speaking",
  listening: "listening…",
  thinking: "thinking…",
  ended: "call ended",
  error: "connection hiccup",
};

function StatusPill({
  status,
  mode,
  startedAt,
  done,
}: {
  status: CallStatus;
  mode: "voice" | "text";
  startedAt: number | null;
  done: boolean;
}) {
  const label =
    status === "listening" && mode === "text" ? "your turn" : status === "ended" && done ? "call complete" : LABELS[status];
  const dot =
    status === "listening"
      ? "bg-ios-green"
      : status === "speaking"
        ? "bg-ios-blue"
        : status === "error"
          ? "bg-ios-red"
          : status === "ended" && done
            ? "bg-ios-green"
            : "bg-faint";
  const pulsing = status === "listening" || status === "speaking" || status === "connecting";

  return (
    <div className="liquid-glass flex h-9 items-center gap-2.5 rounded-full px-4 text-[13px] font-medium">
      <span className="relative flex h-2 w-2">
        {pulsing ? <span className={`absolute inset-0 animate-ping rounded-full opacity-60 ${dot}`} /> : null}
        <span className={`relative h-2 w-2 rounded-full ${dot}`} />
      </span>
      <span aria-live="polite" data-testid="call-status">
        {label}
      </span>
      {startedAt && status !== "ended" && status !== "idle" ? <CallTimer startedAt={startedAt} /> : null}
    </div>
  );
}

function CallTimer({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return (
    <span className="tabular-nums text-muted" aria-hidden>
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
    </span>
  );
}

function Banner({
  children,
  tone = "info",
  onDismiss,
}: {
  children: React.ReactNode;
  tone?: "info" | "error";
  onDismiss?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div
        role={tone === "error" ? "alert" : "status"}
        className={`mb-3 flex items-start justify-between gap-3 rounded-2xl px-4 py-3 text-[14px] leading-snug ${
          tone === "error" ? "bg-ios-red/[0.07] text-ink" : "bg-surface text-ink-soft"
        }`}
      >
        <div className="flex flex-col">{children}</div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="-mr-1 shrink-0 rounded-full px-2 text-[13px] font-medium text-muted hover:text-ink"
          >
            OK
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}
