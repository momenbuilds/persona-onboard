"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo, type Dispatch } from "react";
import { PersonaMark } from "@/components/brand/PersonaLogo";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { GOAL_CHARTS, goalKind, type GoalChart } from "@/lib/conversation/goal-kind";
import { fallbackSavings, formatHours, totals } from "@/lib/conversation/savings";
import type { Action, OnboardingState } from "../state";
import { StepHeading } from "./StepHeading";
import { PuttingItTogether, useUnderstanding } from "./Understanding";

type Props = { state: OnboardingState; dispatch: Dispatch<Action> };

/**
 * Right after the call: where their goal goes with Persona vs. on their own,
 * as a two-line trend chart, plus the hours a week they get back.
 */
export function SavingsStep({ state, dispatch }: Props) {
  const understanding = useUnderstanding(state, dispatch);
  const said = useMemo(
    () => `${state.messages.filter((m) => m.role === "user").map((m) => m.text).join(" ")} ${Object.values(state.notes ?? {}).join(" ")}`,
    [state.messages, state.notes],
  );
  const reduce = !!useReducedMotion();
  if (!understanding) return <PuttingItTogether />;

  const chart = GOAL_CHARTS[goalKind(understanding.primaryGoal, `${understanding.secondaryGoals.join(" ")} ${said}`)];
  const items = understanding.timeSavings?.length ? understanding.timeSavings : fallbackSavings(said);
  const { savedWeek } = totals(items);
  const name = state.userName.trim() || understanding.userName;

  return (
    <section className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 pb-20 pt-8 sm:pt-12">
      <p className="text-center text-[13px] font-medium uppercase tracking-[0.08em] text-faint">your next 6 months</p>
      <StepHeading className="mt-3 text-balance text-center text-[28px] font-medium leading-[1.15] tracking-[-0.03em] sm:text-[36px]">
        {name ? `${name}, here's where this goes.` : "here's where this goes."}
      </StepHeading>
      <p className="mt-3 text-center text-[16px] text-muted">
        for &ldquo;{understanding.primaryGoal}&rdquo;
      </p>

      <motion.figure
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 26, delay: reduce ? 0 : 0.1 }}
        className="mt-7 rounded-[32px] bg-[#f7f7f8] px-5 pb-6 pt-6 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.04)] sm:px-7 sm:pt-7"
      >
        <p className="text-[26px] font-semibold tracking-[-0.03em] text-ink sm:text-[30px]">{chart.title}</p>
        <TrendChart chart={chart} reduce={reduce} />
        <figcaption className="mt-5 text-balance text-center text-[16px] leading-snug text-ink-soft sm:text-[17px]">{chart.caption}</figcaption>
      </motion.figure>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 1.6 }}
        className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[15px] text-ink-soft"
      >
        <span className="whitespace-nowrap rounded-full bg-ios-blue/10 px-3 py-1 font-semibold text-ios-blue">{formatHours(savedWeek)} a week</span>
        <span>back, from what you told me</span>
      </motion.div>
      <p className="mt-3 text-center text-[12px] text-faint">an illustration of the trend based on your call, not measured user data.</p>

      <div className="mt-8 flex justify-center">
        <Button size="lg" onClick={() => dispatch({ type: "go", step: "understanding" })}>
          Continue <ArrowRightIcon className="h-5 w-5" />
        </Button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Two-line trend chart                                                */
/* ------------------------------------------------------------------ */

const W = 340;
const X0 = 18;
const X1 = 322;
const BASE = 150;
/** Mirror line for "up is good" goals, so both layouts share one set of curves. */
const MIRROR = 176;

type Pt = [number, number];
/** Curves drawn for "less is better" (busywork): Persona drops, on-your-own dips then rebounds. */
const PERSONA: Pt[] = [[X0, 62], [120, 60], [160, 70], [200, 108], [240, 144], [270, 150], [X1, 150]];
const ALONE: Pt[] = [[X0, 62], [70, 62], [100, 118], [130, 118], [165, 118], [190, 92], [230, 60], [265, 34], [295, 26], [X1, 26]];

function path(points: Pt[], flip: boolean) {
  const p = points.map(([x, y]) => [x, flip ? MIRROR - y : y] as Pt);
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 1; i + 2 < p.length; i += 3) d += ` C${p[i][0]} ${p[i][1]}, ${p[i + 1][0]} ${p[i + 1][1]}, ${p[i + 2][0]} ${p[i + 2][1]}`;
  return d;
}

function TrendChart({ chart, reduce }: { chart: GoalChart; reduce: boolean }) {
  const flip = chart.upIsGood;
  const y = (v: number) => (flip ? MIRROR - v : v);
  const persona = path(PERSONA, flip);
  const alone = path(ALONE, flip);
  const start = y(62);
  const end = y(150);
  const aloneEnd = y(26);
  const draw = (delay: number, duration: number) =>
    reduce ? { duration: 0 } : { pathLength: { delay, duration, ease: [0.45, 0, 0.2, 1] as const }, opacity: { delay, duration: 0.01 } };

  return (
    <div className="relative mt-3">
      <svg viewBox={`0 0 ${W} 182`} className="w-full overflow-visible" role="img" aria-label={`${chart.title}: with Persona the line ${flip ? "rises" : "falls"} steadily over six months; ${chart.aloneLabel.toLowerCase()} it ${flip ? "rises briefly, then falls back" : "dips briefly, then climbs back"}.`}>
        <defs>
          <linearGradient id="persona-fill" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#1d1d1f" stopOpacity="0.12" />
            <stop offset="1" stopColor="#1d1d1f" stopOpacity="0.02" />
          </linearGradient>
          <clipPath id="alone-tail">
            <rect x="215" y={flip ? start : 0} width={W} height={flip ? 200 : start} />
          </clipPath>
        </defs>

        {/* guides */}
        {[62, 114].map((g) => (
          <line key={g} x1={X0} x2={X1} y1={y(g)} y2={y(g)} stroke="#1d1d1f" strokeOpacity="0.18" strokeDasharray="3 5" />
        ))}
        <line x1={X0} x2={X1} y1={BASE} y2={BASE} stroke="#1d1d1f" strokeOpacity="0.85" strokeWidth="1.2" />

        {/* fills */}
        <motion.path
          d={`${persona} L${X1} ${BASE} L${X0} ${BASE} Z`}
          fill="url(#persona-fill)"
          initial={{ opacity: reduce ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0 : 0.9, duration: 0.6 }}
        />
        <motion.path
          d={`${alone} L${X1} ${start} L${X0} ${start} Z`}
          fill="#e5484d"
          fillOpacity="0.09"
          clipPath="url(#alone-tail)"
          initial={{ opacity: reduce ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0 : 1.5, duration: 0.6 }}
        />

        {/* lines */}
        <motion.path
          d={alone}
          fill="none"
          stroke="#d9625b"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: reduce ? 1 : 0, opacity: reduce ? 1 : 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={draw(0.35, 1.3)}
        />
        <motion.path
          d={persona}
          fill="none"
          stroke="#1d1d1f"
          strokeWidth="3.5"
          strokeLinecap="round"
          initial={{ pathLength: reduce ? 1 : 0, opacity: reduce ? 1 : 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={draw(0.2, 1.3)}
        />

        {/* markers */}
        <circle cx={X0} cy={start} r="8" fill="#fbfbfd" stroke="#1d1d1f" strokeWidth="3" />
        <motion.circle
          cx={X1}
          cy={end}
          r="8"
          fill="#fbfbfd"
          stroke="#1d1d1f"
          strokeWidth="3"
          initial={{ scale: reduce ? 1 : 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: reduce ? 0 : 1.45, type: "spring", stiffness: 500, damping: 18 }}
          style={{ transformOrigin: `${X1}px ${end}px` }}
        />

        {/* on-your-own label, beside the end of its line */}
        <motion.text
          x={X1}
          // Clear space beside the red tail: above the dashed guide when mirrored, below it otherwise.
          y={flip ? y(62) - 14 : aloneEnd + 26}
          textAnchor="end"
          className="fill-ink text-[15px] font-medium"
          initial={{ opacity: reduce ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0 : 1.6 }}
        >
          {chart.aloneLabel}
        </motion.text>

        <text x={X0} y={BASE + 28} className="fill-ink text-[15px] font-medium">
          Month 1
        </text>
        <text x={X1} y={BASE + 28} textAnchor="end" className="fill-ink text-[15px] font-medium">
          Month 6
        </text>
      </svg>

      {/* brand badge, bottom-left inside the plot, like a product label */}
      <div
        className="pointer-events-none absolute left-[5.5%] flex items-center gap-2"
        style={{ top: `${((BASE - 26) / 182) * 100}%` }}
        aria-hidden
      >
        <PersonaMark className="h-[18px] w-[18px] text-ink" />
        <span className="text-[16px] font-semibold tracking-[-0.02em] text-ink">Persona</span>
        <span className="rounded-full bg-ink px-2.5 py-0.5 text-[12px] font-medium text-white">{chart.badge}</span>
      </div>
    </div>
  );
}
