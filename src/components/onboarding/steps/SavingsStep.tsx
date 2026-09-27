"use client";

import { animate, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState, type Dispatch } from "react";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { fallbackSavings, shortHours, totals } from "@/lib/conversation/savings";
import type { Action, OnboardingState } from "../state";
import { StepHeading } from "./StepHeading";

type Props = { state: OnboardingState; dispatch: Dispatch<Action> };

/**
 * "Time back": weekly hours per task by hand vs. with Persona, estimated from
 * what the user said on the call (DeepSeek, or a keyword fallback).
 */
export function SavingsStep({ state, dispatch }: Props) {
  const agent = state.agentName || "Persona";
  const items = useMemo(() => {
    const fromCall = state.understanding?.timeSavings;
    if (fromCall?.length) return fromCall;
    const said = state.messages.filter((m) => m.role === "user").map((m) => m.text).join(" ");
    return fallbackSavings(`${said} ${Object.values(state.notes ?? {}).join(" ")}`);
  }, [state.understanding, state.messages, state.notes]);
  const { savedWeek, savedMonth } = totals(items);
  const max = Math.max(...items.map((i) => i.manualHours));
  const reduce = useReducedMotion();

  return (
    <section className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 pb-20 pt-10 sm:pt-16">
      <p className="text-center text-[13px] font-medium uppercase tracking-[0.08em] text-faint">time back</p>
      <StepHeading className="mt-3 text-balance text-center text-[26px] font-medium leading-[1.2] tracking-[-0.03em] sm:text-[32px]">
        with {agent}, you get back about
        <span className="mt-1 block text-[56px] font-semibold leading-none tracking-[-0.04em] text-ios-blue sm:text-[72px]">
          <CountUp value={savedWeek} reduce={!!reduce} />
          <span className="ml-2 text-[26px] font-medium tracking-[-0.03em] text-ink sm:text-[32px]">
            {savedWeek === 1 ? "hour" : "hours"} a week
          </span>
        </span>
      </StepHeading>
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 0.5 }}
        className="mt-4 text-center text-[16px] text-muted"
      >
        that&apos;s roughly {savedMonth} hours a month, based on what you told me.
      </motion.p>

      <motion.figure
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 0.25, type: "spring", stiffness: 220, damping: 26 }}
        className="glass-card mt-8 rounded-[28px] p-5 sm:p-6"
        aria-label={`Weekly hours by task, doing it yourself vs. with ${agent}`}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted" aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-surface-2 ring-1 ring-inset ring-black/10" /> doing it yourself
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-ios-blue" /> with {agent}
          </span>
          <span className="ml-auto">hours / week</span>
        </div>

        <ul className="mt-5 flex flex-col gap-5">
          {items.map((item, i) => {
            const saved = item.manualHours - item.withPersonaHours;
            const delay = reduce ? 0 : 0.45 + i * 0.12;
            return (
              <li key={item.task}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-medium text-ink">{item.task}</span>
                  <span className="shrink-0 text-[13px] font-medium text-[#1f9d45]">saves {shortHours(saved)}</span>
                </div>
                <p className="sr-only">
                  {shortHours(item.manualHours)} doing it yourself, {shortHours(item.withPersonaHours)} with {agent}.
                </p>
                <div className="mt-2 flex flex-col gap-1.5" aria-hidden>
                  <Bar width={item.manualHours / max} delay={delay} reduce={!!reduce} tone="manual" label={shortHours(item.manualHours)} />
                  <Bar width={item.withPersonaHours / max} delay={delay + 0.15} reduce={!!reduce} tone="persona" label={shortHours(item.withPersonaHours)} />
                </div>
              </li>
            );
          })}
        </ul>
        <figcaption className="mt-5 text-[12px] text-faint">an estimate from your call, not a promise. it gets sharper as {agent} learns your week.</figcaption>
      </motion.figure>

      <div className="mt-8 flex justify-center">
        <Button size="lg" onClick={() => dispatch({ type: "go", step: "gmail" })}>
          Continue <ArrowRightIcon className="h-5 w-5" />
        </Button>
      </div>
    </section>
  );
}

function Bar({
  width,
  delay,
  reduce,
  tone,
  label,
}: {
  width: number;
  delay: number;
  reduce: boolean;
  tone: "manual" | "persona";
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface">
        <motion.div
          initial={{ width: reduce ? `${width * 100}%` : "0%" }}
          animate={{ width: `${Math.max(width * 100, 3)}%` }}
          transition={{ delay, duration: reduce ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] }}
          className={`h-full rounded-full ${tone === "persona" ? "bg-gradient-to-r from-[#5ac8fa] to-ios-blue" : "bg-[#c7c7cc]"}`}
        />
      </div>
      <span className={`w-10 shrink-0 text-right text-[12.5px] tabular-nums ${tone === "persona" ? "font-semibold text-ios-blue" : "text-muted"}`}>
        {label}
      </span>
    </div>
  );
}

function CountUp({ value, reduce }: { value: number; reduce: boolean }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const controls = animate(0, value, {
      duration: reduce ? 0 : 1.3,
      delay: reduce ? 0 : 0.35,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setShown,
    });
    return () => controls.stop();
  }, [value, reduce]);
  return <span className="tabular-nums">{Number.isInteger(value) ? Math.round(shown) : shown.toFixed(1)}</span>;
}
