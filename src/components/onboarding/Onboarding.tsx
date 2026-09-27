"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PersonaLockup } from "@/components/brand/PersonaLogo";
import { IconButton } from "@/components/ui/Button";
import { SpeakerIcon, SpeakerOffIcon } from "@/components/ui/icons";
import { fetchHealth } from "@/lib/api";
import type { HealthResponse } from "@/lib/schema";
import { CallStep } from "./steps/CallStep";
import { CelebrateStep } from "./steps/CelebrateStep";
import dynamic from "next/dynamic";

// The dashboard carries markdown, KaTeX and chart code: load it only when it's shown,
// so the landing page and onboarding stay light.
const Dashboard = dynamic(() => import("./steps/Dashboard").then((m) => m.Dashboard), {
  ssr: false,
  loading: () => <div className="flex flex-1 items-center justify-center text-[14px] text-muted">opening your dashboard…</div>,
});
import { GmailStep } from "./steps/GmailStep";
import { ReadyStep } from "./steps/ReadyStep";
import { SavingsStep } from "./steps/SavingsStep";
import { UnderstandingStep } from "./steps/UnderstandingStep";
import { WelcomeStep } from "./steps/WelcomeStep";
import { STEPS, useOnboarding, type Step } from "./state";

function pageHidden() {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

export function Onboarding() {
  const { state, dispatch, hydrated } = useOnboarding();
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    void fetchHealth().then(setHealth);
  }, []);

  // Each new screen starts at its heading, not wherever the last one was scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [state.step]);

  const demoMode = health && (!health.voice || !health.understanding);
  const demoTitle = health
    ? [
        !health.voice && "ASSEMBLYAI_API_KEY missing: answers are typed and Persona uses the browser voice",
        !health.understanding && "OPENROUTER_API_KEY missing: understanding runs on the built-in fallback",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <Backdrop step={state.step} />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-3 px-5 pt-5 sm:flex-nowrap sm:px-8 sm:pt-7">
        <Link href="/" className="rounded-md" aria-label="Persona home">
          <PersonaLockup height={22} priority />
        </Link>

        {state.step !== "dashboard" ? <Progress current={state.step} /> : null}

        <div className="flex items-center gap-2">
          {demoMode ? (
            <span
              title={demoTitle}
              className="hidden rounded-full bg-surface px-3 py-1 text-[12px] font-medium text-muted sm:inline-block"
            >
              demo mode<span className="sr-only">: {demoTitle}</span>
            </span>
          ) : null}
          <IconButton
            label={state.muted ? "Unmute Persona's voice" : "Mute Persona's voice"}
            aria-pressed={state.muted}
            className="h-9 w-9"
            onClick={() => dispatch({ type: "setMuted", muted: !state.muted })}
          >
            {state.muted ? <SpeakerOffIcon className="h-[18px] w-[18px]" /> : <SpeakerIcon className="h-[18px] w-[18px]" />}
          </IconButton>
          {state.step !== "welcome" ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "reset" })}
              className="rounded-full px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-black/[0.04] hover:text-ink"
            >
              Start over
            </button>
          ) : null}
        </div>
      </header>

      <main id="main" className="relative z-10 flex flex-1 flex-col">
        {hydrated ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={state.step}
              className="flex flex-1 flex-col"
              // Hidden tabs get no animation frames, so an exit animation there would
              // stall the step change until the user comes back. Swap instantly instead.
              initial={pageHidden() ? false : { opacity: 0, y: 18, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={pageHidden() ? undefined : { opacity: 0, y: -12, filter: "blur(8px)" }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              {state.step === "welcome" && <WelcomeStep dispatch={dispatch} />}
              {state.step === "call" && (
                <CallStep
                  state={state}
                  dispatch={dispatch}
                  transcriptionAvailable={health ? health.transcription : null}
                  voiceAvailable={health ? health.voice : null}
                />
              )}
              {state.step === "understanding" && <UnderstandingStep state={state} dispatch={dispatch} />}
              {state.step === "savings" && <SavingsStep state={state} dispatch={dispatch} />}
              {state.step === "celebrate" && <CelebrateStep state={state} dispatch={dispatch} />}
              {state.step === "gmail" && <GmailStep state={state} dispatch={dispatch} />}
              {state.step === "ready" && <ReadyStep state={state} dispatch={dispatch} />}
              {state.step === "dashboard" && <Dashboard state={state} dispatch={dispatch} />}
            </motion.div>
          </AnimatePresence>
        ) : null}
      </main>
    </div>
  );
}

function Progress({ current }: { current: Step }) {
  const index = STEPS.findIndex((s) => s.id === current);
  return (
    <nav aria-label="Onboarding progress" className="order-last flex w-full justify-center pt-3 sm:order-none sm:w-auto sm:pt-0">
      <ol className="flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <li key={s.id} aria-current={i === index ? "step" : undefined}>
            <span className="sr-only">
              Step {i + 1} of {STEPS.length}: {s.label}
              {i < index ? " (done)" : ""}
            </span>
            <motion.span
              aria-hidden
              className="block h-1.5 rounded-full"
              animate={{
                width: i === index ? 22 : 6,
                backgroundColor: i === index ? "#1d1d1f" : i < index ? "rgba(29,29,31,0.35)" : "rgba(29,29,31,0.12)",
              }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Soft, slowly shifting light behind the flow — white stays white. */
function Backdrop({ step }: { step: Step }) {
  const tint = step === "gmail" ? "rgb(234 67 53 / 0.06)" : step === "ready" || step === "dashboard" ? "rgb(48 209 88 / 0.05)" : "rgb(10 132 255 / 0.06)";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute left-1/2 top-[-20%] h-[70vh] w-[110vw] -translate-x-1/2 rounded-full blur-3xl"
        animate={{ background: `radial-gradient(closest-side, ${tint}, transparent)` }}
        transition={{ duration: 1.2 }}
      />
    </div>
  );
}
