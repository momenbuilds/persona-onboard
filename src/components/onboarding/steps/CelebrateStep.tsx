"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type Dispatch } from "react";
import { PersonaOrb } from "@/components/orb/PersonaOrb";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { playCelebration } from "@/lib/sound/celebrate";
import type { Action, OnboardingState } from "../state";
import { StepHeading } from "./StepHeading";

type Props = { state: OnboardingState; dispatch: Dispatch<Action> };

/** Goals usually start with a verb ("Grow…", "Stay…"): "set yourself up to grow…". Otherwise "…for …". */
const VERB = /^(stay|keep|get|grow|reach|hit|land|ship|launch|build|make|finish|save|find|stop|start|balance|manage|track|run|lose|gain|pass|learn|write|plan|organi[sz]e|clear|catch|win|earn|raise|close|protect|spend|cut|pay|create|post|sleep|eat|train|nail|crush|master|become|double|triple|scale|sell|hire)\b/i;

function goalLine(goal: string) {
  const g = goal.trim().replace(/[.!]+$/, "");
  if (!g) return "you just set yourself up for a calmer week.";
  const lc = g[0].toLowerCase() + g.slice(1);
  return VERB.test(g) ? `you just set yourself up to ${lc}.` : `you just set yourself up for ${lc}.`;
}

/**
 * The payoff after naming the agent: the orb shakes like a bottle, pops with a
 * cork-and-fizz sound, and confetti bursts out of it. Respects mute and reduced motion.
 */
export function CelebrateStep({ state, dispatch }: Props) {
  const agent = state.agentName || "Persona";
  const name = state.userName.trim();
  const reduce = !!useReducedMotion();
  const [phase, setPhase] = useState<"shake" | "popped">(reduce ? "popped" : "shake");
  const orb = useRef<HTMLDivElement>(null);
  const muted = state.muted;

  // Pops once per visit. (No "already fired" guard: StrictMode's mount-unmount-mount
  // would cancel the first timer and skip the second; the cleanup handles it.)
  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const pop = async () => {
      if (cancelled) return;
      setPhase("popped");
      if (!muted) {
        try {
          playCelebration();
        } catch {
          // Audio is a bonus; never block the moment on it.
        }
      }
      const { default: confetti } = await import("canvas-confetti");
      if (cancelled) return;
      const r = orb.current?.getBoundingClientRect();
      const origin = r
        ? { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 3) / window.innerHeight }
        : { x: 0.5, y: 0.3 };
      const scalar = 2.2;
      const emoji = ["🎉", "🥂", "✨"].map((text) => confetti.shapeFromText({ text, scalar }));
      const colors = ["#0a84ff", "#5ac8fa", "#30d158", "#ffd60a", "#ff375f", "#ffffff"];
      // Out of the bottle: a tight upward burst…
      void confetti({ particleCount: 90, spread: 70, startVelocity: 48, gravity: 0.9, ticks: 220, origin, colors, disableForReducedMotion: true });
      void confetti({ particleCount: 18, spread: 80, startVelocity: 42, scalar, shapes: emoji, ticks: 240, origin, disableForReducedMotion: true });
      // …then the side cannons as the headline lands.
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          void confetti({ particleCount: 60, angle: 60, spread: 60, startVelocity: 55, origin: { x: 0, y: 0.75 }, colors, disableForReducedMotion: true });
          void confetti({ particleCount: 60, angle: 120, spread: 60, startVelocity: 55, origin: { x: 1, y: 0.75 }, colors, disableForReducedMotion: true });
        }, 450),
      );
    };

    timers.push(setTimeout(() => void pop(), reduce ? 150 : 900));
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // Celebrate once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goal = state.understanding?.primaryGoal ?? "";

  return (
    <section className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-6 pb-20 pt-10 text-center sm:pt-16">
      <div ref={orb} className="relative">
        <motion.div
          animate={
            phase === "shake"
              ? { rotate: [0, -9, 9, -8, 8, -5, 5, -2, 0], scale: [1, 0.97, 0.97, 0.96, 0.96, 0.95, 0.95, 0.94, 0.94] }
              : { rotate: 0, scale: [0.94, 1.14, 1], y: [0, -26, 0] }
          }
          transition={phase === "shake" ? { duration: 0.85, ease: "easeInOut" } : { duration: 0.6, ease: [0.2, 1.4, 0.4, 1] }}
        >
          <PersonaOrb size={140} state={phase === "popped" ? "speaking" : "thinking"} />
        </motion.div>
        {/* The pop: a quick ring flash out of the top of the orb. */}
        <AnimatePresence>
          {phase === "popped" && !reduce ? (
            <motion.span
              key="ring"
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full border-[3px] border-ios-blue/60"
              initial={{ scale: 0.8, opacity: 0.9 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {phase === "popped" ? (
          <motion.div
            key="copy"
            className="flex flex-col items-center"
            initial="hidden"
            animate="shown"
            variants={{ shown: { transition: { staggerChildren: reduce ? 0 : 0.12, delayChildren: reduce ? 0 : 0.15 } } }}
          >
            <motion.span
              aria-hidden
              className="mt-8 text-[56px] leading-none"
              variants={{ hidden: { scale: 0, rotate: -30 }, shown: { scale: 1, rotate: 0, transition: { type: "spring", stiffness: 420, damping: 12 } } }}
            >
              🎉
            </motion.span>
            <motion.div variants={{ hidden: { opacity: 0, y: 14 }, shown: { opacity: 1, y: 0 } }}>
              <StepHeading className="mt-5 text-balance text-[34px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[44px]">
                {name ? `congrats, ${name}!` : "congrats!"}
              </StepHeading>
            </motion.div>
            <motion.p
              className="mt-4 max-w-md text-balance text-[18px] leading-snug text-ink-soft"
              variants={{ hidden: { opacity: 0, y: 10 }, shown: { opacity: 1, y: 0 } }}
            >
              {goalLine(goal)}
            </motion.p>
            <motion.p className="mt-2 text-[16px] text-muted" variants={{ hidden: { opacity: 0 }, shown: { opacity: 1 } }}>
              {agent} is on it from today. 🥂
            </motion.p>
            <motion.div className="mt-10" variants={{ hidden: { opacity: 0, y: 10 }, shown: { opacity: 1, y: 0 } }}>
              <Button size="lg" onClick={() => dispatch({ type: "go", step: "gmail" })} autoFocus>
                Let&apos;s go <ArrowRightIcon className="h-5 w-5" />
              </Button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.p key="wait" className="mt-10 text-[16px] text-muted" exit={{ opacity: 0 }}>
            setting you up…
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}
