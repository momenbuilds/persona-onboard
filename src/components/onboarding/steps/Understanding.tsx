"use client";

import { useEffect, useRef, type Dispatch } from "react";
import { PersonaOrb } from "@/components/orb/PersonaOrb";
import { understand } from "@/lib/api";
import type { Action, OnboardingState } from "../state";
import { StepHeading } from "./StepHeading";

/**
 * Runs the understanding (summary, goals, names, time saved) once per transcript,
 * on whichever post-call screen the user lands on first. The ref guards StrictMode's
 * double effect.
 */
export function useUnderstanding(state: OnboardingState, dispatch: Dispatch<Action>) {
  const { understanding, messages, notes } = state;
  const requested = useRef(false);
  useEffect(() => {
    if (understanding || requested.current) return;
    requested.current = true;
    void understand(messages, notes).then((res) =>
      dispatch({ type: "setUnderstanding", understanding: res.understanding, source: res.source }),
    );
  }, [understanding, messages, notes, dispatch]);
  return understanding;
}

export function PuttingItTogether() {
  return (
    <section className="mx-auto flex flex-1 flex-col items-center justify-center gap-7 px-6 pb-24 text-center" aria-busy>
      <PersonaOrb state="thinking" size={132} />
      <StepHeading className="text-[22px] font-medium tracking-[-0.02em] text-ink-soft">putting it together…</StepHeading>
    </section>
  );
}
