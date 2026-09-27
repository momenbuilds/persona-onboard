"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState, type Dispatch } from "react";
import { PersonaOrb } from "@/components/orb/PersonaOrb";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon, CheckIcon, PencilIcon, RetryIcon } from "@/components/ui/icons";
import { understand } from "@/lib/api";
import { isBlockedAgentName } from "@/lib/conversation/needs";
import { prefetchInbox } from "@/lib/demo/inbox-prefetch";
import { AgentNameSchema } from "@/lib/schema";
import type { Action, OnboardingState } from "../state";
import { StepHeading } from "./StepHeading";

type Props = { state: OnboardingState; dispatch: Dispatch<Action> };

export function UnderstandingStep({ state, dispatch }: Props) {
  const { understanding, messages, notes } = state;

  // Run the understanding once per transcript. The ref guards StrictMode's double effect.
  const requested = useRef(false);
  useEffect(() => {
    if (understanding || requested.current) return;
    requested.current = true;
    void understand(messages, notes).then((res) =>
      dispatch({ type: "setUnderstanding", understanding: res.understanding, source: res.source }),
    );
  }, [understanding, messages, notes, dispatch]);

  if (!understanding) {
    return (
      <section className="mx-auto flex flex-1 flex-col items-center justify-center gap-7 px-6 pb-24 text-center" aria-busy>
        <PersonaOrb state="thinking" size={132} />
        <StepHeading className="text-[22px] font-medium tracking-[-0.02em] text-ink-soft">putting it together…</StepHeading>
      </section>
    );
  }

  return <Summary state={state} dispatch={dispatch} />;
}

function Summary({ state, dispatch }: Props) {
  const u = state.understanding!;
  const words = u.summary.split(" ");
  const [custom, setCustom] = useState(
    state.agentName && !u.suggestedAgentNames.includes(state.agentName) ? state.agentName : "",
  );
  const [customTouched, setCustomTouched] = useState(false);
  const customId = useId();
  const nameId = useId();

  // Stable chip order, so picking a goal doesn't shuffle the row under your finger.
  const [goals] = useState(() => [u.primaryGoal, ...u.secondaryGoals]);

  // Start the demo inbox now so the Gmail step doesn't wait on it (debounced for goal flips).
  const { userName, notes } = state;
  useEffect(() => {
    const t = setTimeout(() => {
      void prefetchInbox({ userName, summary: u.summary, primaryGoal: u.primaryGoal, secondaryGoals: u.secondaryGoals, notes });
    }, 400);
    return () => clearTimeout(t);
    // userName is edited live on this screen; the inbox doesn't need to follow every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [u.summary, u.primaryGoal]);

  // "new ideas": fresh names from the user's own data, never repeating ones already shown.
  const shown = useRef(new Set(u.suggestedAgentNames));
  const [shuffling, setShuffling] = useState(false);
  async function shuffle() {
    setShuffling(true);
    try {
      const res = await fetch("/api/names", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userName: state.userName,
          summary: u.summary,
          goals: [u.primaryGoal, ...u.secondaryGoals],
          exclude: [...shown.current],
        }),
      });
      const { names } = (await res.json()) as { names?: string[] };
      if (names?.length === 3) {
        names.forEach((n) => shown.current.add(n));
        if (state.agentName && u.suggestedAgentNames.includes(state.agentName)) dispatch({ type: "setAgentName", name: "" });
        dispatch({ type: "setSuggestedNames", names });
      }
    } catch {
      // keep the current ideas
    } finally {
      setShuffling(false);
    }
  }

  const customError = customTouched && custom ? agentNameError(custom) : null;
  const agentValid = !!state.agentName && !agentNameError(state.agentName);
  const canContinue = agentValid && state.userName.trim().length > 0;

  return (
    <section className="mx-auto w-full max-w-2xl px-6 pb-20 pt-10 sm:pt-16">
      <p className="text-[15px] font-medium text-muted">here&apos;s what i got</p>

      <StepHeading className="mt-3 text-balance text-[30px] font-medium leading-[1.15] tracking-[-0.025em] sm:text-[40px]">
        <span className="sr-only">{u.summary}</span>
        <span aria-hidden>
          {words.map((w, i) => (
            <motion.span
              key={i}
              className="inline-block whitespace-pre"
              initial={{ opacity: 0, y: 6, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.1 + i * 0.035, duration: 0.45 }}
            >
              {w}
              {i < words.length - 1 ? " " : ""}
            </motion.span>
          ))}
        </span>
      </StepHeading>

      <motion.div
        className="mt-8"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 + words.length * 0.035 }}
      >
        <p id={`${nameId}-goal`} className="text-[14px] text-muted">
          which one matters most right now?
        </p>
        <div role="radiogroup" aria-labelledby={`${nameId}-goal`} className="mt-3 flex flex-wrap gap-2">
          {goals.map((g, i) => {
            const selected = u.primaryGoal === g;
            return (
              <motion.button
                key={g}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => dispatch({ type: "setPrimaryGoal", goal: g })}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35 + words.length * 0.035 + i * 0.06, type: "spring", stiffness: 400, damping: 26 }}
                whileTap={{ scale: 0.95 }}
                className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] transition-colors duration-300 ${
                  selected ? "text-white" : "liquid-glass text-ink-soft hover:text-ink"
                }`}
              >
                {selected ? (
                  <motion.span
                    layoutId="goal-pill"
                    className="ink-glass absolute inset-0 -z-10 rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 34 }}
                  />
                ) : null}
                {selected ? <CheckIcon className="h-3.5 w-3.5" /> : null}
                <span className={selected ? "font-medium" : ""}>{g}</span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 text-[17px]">
        <label htmlFor={nameId} className="text-muted">
          i&apos;ll call you
        </label>
        <span className="liquid-glass inline-flex items-center gap-2 rounded-full py-1.5 pl-4 pr-3 focus-within:ring-2 focus-within:ring-ios-blue/60">
          <input
            id={nameId}
            value={state.userName}
            onChange={(e) => dispatch({ type: "setUserName", name: e.target.value.slice(0, 40) })}
            placeholder="your name"
            autoComplete="given-name"
            className="w-[9ch] min-w-0 bg-transparent font-medium text-ink outline-none placeholder:font-normal placeholder:text-faint focus-visible:outline-none"
            style={{ width: `${Math.max(9, state.userName.length + 1)}ch` }}
          />
          <PencilIcon className="h-4 w-4 text-faint" />
        </span>
      </div>

      <div className="mt-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[22px] font-medium tracking-[-0.02em]">now, name your Persona</h2>
            <p className="mt-1 text-[15px] text-muted">a few ideas made for you, or pick your own.</p>
          </div>
          <button
            type="button"
            onClick={() => void shuffle()}
            disabled={shuffling}
            className="liquid-glass inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-60"
          >
            <motion.span
              animate={shuffling ? { rotate: 360 } : { rotate: 0 }}
              transition={shuffling ? { duration: 0.8, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}
              className="inline-flex"
            >
              <RetryIcon className="h-4 w-4" />
            </motion.span>
            {shuffling ? "thinking…" : "new ideas"}
          </button>
        </div>

        <div role="radiogroup" aria-label="Agent name" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AnimatePresence mode="popLayout" initial={false}>
          {u.suggestedAgentNames.map((name, i) => {
            const selected = state.agentName === name;
            return (
              <motion.button
                layout
                key={name}
                type="button"
                role="radio"
                aria-checked={selected}
                initial={{ opacity: 0, y: 14, scale: 0.94, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, scale: 0.94, filter: "blur(6px)" }}
                transition={{ type: "spring", stiffness: 380, damping: 28, delay: i * 0.06 }}
                onClick={() => {
                  setCustom("");
                  setCustomTouched(false);
                  dispatch({ type: "setAgentName", name });
                }}
                className={`group relative flex items-center gap-3 rounded-[22px] p-3 pr-4 text-left transition-[box-shadow] duration-200 active:scale-[0.98] ${
                  selected ? "glass-card ring-2 ring-ink" : "liquid-glass hover:-translate-y-0.5"
                }`}
              >
                <PersonaOrb size={40} state="idle" />
                <span className="text-[18px] font-medium tracking-[-0.01em]">{name}</span>
                {selected ? (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white"
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                  </motion.span>
                ) : null}
              </motion.button>
            );
          })}
          </AnimatePresence>
        </div>

        <div className="mt-3">
          <label htmlFor={customId} className="sr-only">
            Custom agent name
          </label>
          <div
            className={`liquid-glass flex items-center gap-3 rounded-[22px] py-2 pl-4 pr-2 focus-within:ring-2 focus-within:ring-ios-blue/60 ${
              custom && state.agentName === custom.trim() && !agentNameError(custom) ? "ring-2 ring-ink" : ""
            }`}
          >
            <span className="text-[15px] text-muted">or</span>
            <input
              id={customId}
              value={custom}
              maxLength={16}
              placeholder="type your own name"
              aria-invalid={!!customError}
              aria-describedby={customError ? `${customId}-error` : undefined}
              onChange={(e) => {
                const v = e.target.value;
                setCustom(v);
                setCustomTouched(true);
                dispatch({ type: "setAgentName", name: agentNameError(v) ? "" : v.trim() });
              }}
              className="h-10 min-w-0 flex-1 bg-transparent text-[17px] font-medium outline-none placeholder:font-normal placeholder:text-faint focus-visible:outline-none"
            />
          </div>
          {customError ? (
            <p id={`${customId}-error`} className="mt-2 pl-4 text-[13px] text-ios-red" role="alert">
              {customError}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-12 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "reopenCall" })}>
            add something i missed
          </Button>
          <SourceBadge source={state.source} />
        </div>
        <Button size="lg" disabled={!canContinue} onClick={() => dispatch({ type: "go", step: "savings" })}>
          Continue <ArrowRightIcon className="h-5 w-5" />
        </Button>
      </div>
      {!canContinue ? (
        <p className="mt-3 text-center text-[13px] text-faint sm:text-right" aria-live="polite">
          {!state.userName.trim() ? "add your name to continue" : "pick a name for your Persona to continue"}
        </p>
      ) : null}
    </section>
  );
}

function agentNameError(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (!AgentNameSchema.safeParse(v).success) return "use 2–16 letters (spaces and hyphens are fine).";
  if (isBlockedAgentName(v)) return "that one's taken by someone famous. pick something that's just yours.";
  return null;
}

function SourceBadge({ source }: { source: OnboardingState["source"] }) {
  if (!source) return null;
  return (
    <span className="px-3 text-[12px] text-faint">
      {source === "deepseek" ? "understood with DeepSeek V4.1 Flash" : "understood on the built-in fallback (demo mode)"}
    </span>
  );
}
