"use client";

import { motion } from "framer-motion";
import type { Dispatch } from "react";
import { PersonaOrb } from "@/components/orb/PersonaOrb";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon, CheckIcon, PlusIcon } from "@/components/ui/icons";
import type { Action, OnboardingState } from "../state";
import { StepHeading } from "./StepHeading";

type Props = { state: OnboardingState; dispatch: Dispatch<Action> };

export function ReadyStep({ state, dispatch }: Props) {
  const agent = state.agentName || "Persona";
  const name = state.userName.trim();
  // Silent on purpose: after the call, Persona only speaks when you start a call.

  return (
    <section className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-6 pb-20 pt-10 text-center sm:pt-16">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 160, damping: 16 }}>
        <PersonaOrb size={156} state="idle" />
      </motion.div>

      <StepHeading className="mt-10 text-[36px] font-medium leading-[1.05] tracking-[-0.035em] sm:text-[48px]">
        {agent} is ready.
      </StepHeading>
      <p className="mt-3 text-[18px] text-muted">
        hi {name || "there"}, i&apos;m {agent}. here&apos;s what i&apos;m keeping in mind:
      </p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card mt-8 w-full rounded-[28px] p-6 text-left"
      >
        <p className="text-[18px] leading-snug tracking-[-0.01em]">{state.understanding?.summary}</p>
        {state.gmail === "connected" ? (
          <p className="mt-4 flex items-center gap-2 text-[13px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-ios-green" /> Gmail connected
          </p>
        ) : null}
      </motion.div>

      <div className="mt-10 w-full text-left">
        <h2 className="text-[15px] font-medium text-muted">want a few reminders to start? (optional)</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {state.reminders.map((r, i) => (
            <li key={`${r.title}-${i}`}>
              <button
                type="button"
                aria-pressed={r.added}
                onClick={() => dispatch({ type: "toggleReminder", index: i })}
                className={`flex w-full items-center gap-3 rounded-[20px] px-4 py-3 text-left transition-[background-color,box-shadow,transform] duration-200 active:scale-[0.99] ${
                  r.added ? "ink-glass" : "liquid-glass"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    r.added ? "bg-white text-ink" : "bg-surface text-ink"
                  }`}
                >
                  {r.added ? <CheckIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
                </span>
                <span className="flex-1 text-[16px] font-medium">{r.title}</span>
                <span className={`text-[13px] ${r.added ? "text-white/70" : "text-muted"}`}>{r.when}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Button size="lg" className="mt-11 w-full sm:w-auto" onClick={() => dispatch({ type: "go", step: "dashboard" })}>
        Open dashboard <ArrowRightIcon className="h-5 w-5" />
      </Button>
    </section>
  );
}
