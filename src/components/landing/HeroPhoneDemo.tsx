"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PersonaMark } from "@/components/brand/PersonaLogo";
import { PersonaOrb, type OrbState } from "@/components/orb/PersonaOrb";
import { Waveform } from "@/components/orb/Waveform";
import { PhoneFrame } from "@/components/PhoneFrame";
import { Bubble } from "@/components/ui/Bubble";
import { OPENER } from "@/lib/conversation/engine";
import { createLevelSource, syntheticSpeech } from "@/lib/voice/level";

type Line = { from: "persona" | "user"; text: string };

const LINES: Line[] = [
  { from: "persona", text: OPENER },
  {
    from: "user",
    text: "i'm Maya. up at 6, then shoots and emails for my fashion brand. i need help staying consistent with content.",
  },
  { from: "persona", text: "nice to meet you, Maya. building your fashion brand, love that. i've got what i need." },
];

/** Scripted beats of the loop: [ms, orb state, lines shown, show summary card] */
const BEATS: [number, OrbState, number, boolean][] = [
  [0, "connecting", 0, false],
  [900, "speaking", 1, false],
  [3600, "listening", 1, false],
  [6400, "thinking", 2, false],
  [7400, "speaking", 3, false],
  [10200, "idle", 3, true],
];
const LOOP_MS = 14500;

/**
 * The hero phone plays a short, looping preview of the new voice onboarding
 * so the change is obvious at first glance. Tapping it opens /start.
 */
export function HeroPhoneDemo() {
  const reduce = useReducedMotion();
  const [beat, setBeat] = useState(reduce ? BEATS.length - 1 : 0);
  const level = useMemo(() => createLevelSource(), []);
  const [, orbState, shown, summary] = BEATS[beat];

  useEffect(() => {
    if (reduce) return;
    let timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      timers = BEATS.map(([at], i) => setTimeout(() => setBeat(i), at));
      timers.push(setTimeout(run, LOOP_MS));
    };
    run();
    return () => timers.forEach(clearTimeout);
  }, [reduce]);

  useEffect(() => {
    if (orbState === "speaking") level.set(syntheticSpeech());
    else if (orbState === "listening") level.set(syntheticSpeech(4.2));
    else level.set(null);
  }, [orbState, level]);

  return (
    <Link
      href="/start"
      aria-label="Preview of Persona's voice onboarding. Open it"
      className="group block rounded-[48px] transition-transform duration-500 ease-(--ease-soft) hover:-translate-y-1"
    >
      <PhoneFrame>
        <div aria-hidden className="flex h-full flex-col px-[7%] pb-[9%] pt-[15%]">
          {/* iMessage-style header */}
          <div className="flex flex-col items-center gap-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface">
              <PersonaMark className="h-auto w-[15px]" />
            </span>
            <span className="rounded-full bg-surface px-2 py-[1px] text-[9.5px] font-semibold">Persona ›</span>
          </div>

          <div className="mt-4 flex flex-col items-center">
            <PersonaOrb size={78} state={orbState} level={level} />
            <div className="mt-2.5 h-6 w-24">
              <Waveform level={level} active={orbState === "speaking" || orbState === "listening"} height={22} bars={18} />
            </div>
            <span className="mt-1 text-[9.5px] font-medium text-muted">
              {orbState === "connecting"
                ? "connecting…"
                : orbState === "listening"
                  ? "listening…"
                  : orbState === "thinking"
                    ? "thinking…"
                    : orbState === "speaking"
                      ? "Persona is speaking"
                      : "call complete"}
            </span>
          </div>

          <div className="mt-3 flex flex-1 flex-col justify-end gap-1.5 overflow-hidden">
            {LINES.slice(0, shown).map((l, i) => (
              <Bubble key={i} from={l.from} size="sm" tail>
                {l.text}
              </Bubble>
            ))}
            <AnimatePresence>
              {summary ? (
                <motion.div
                  initial={{ opacity: 0, y: 14, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 24 }}
                  className="glass-card mt-1.5 rounded-[18px] p-3"
                >
                  <p className="text-[9px] font-medium text-muted">here&apos;s what i got</p>
                  <p className="mt-1 text-[11.5px] font-medium leading-snug">
                    you&apos;re building a fashion brand and want help staying consistent with content.
                  </p>
                  <div className="mt-2 flex gap-1">
                    {["Nova", "Orbit", "Atlas"].map((n, i) => (
                      <span
                        key={n}
                        className={`rounded-full px-2 py-0.5 text-[9.5px] font-medium ${i === 0 ? "bg-ink text-white" : "bg-surface"}`}
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </PhoneFrame>
    </Link>
  );
}
