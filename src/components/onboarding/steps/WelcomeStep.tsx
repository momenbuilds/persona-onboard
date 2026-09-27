"use client";

import { motion } from "framer-motion";
import type { Dispatch } from "react";
import { PersonaOrb } from "@/components/orb/PersonaOrb";
import { Button } from "@/components/ui/Button";
import { KeyboardIcon, PhoneIcon } from "@/components/ui/icons";
import { WELCOME_LINE } from "@/lib/conversation/engine";
import { primeCallAudio } from "@/lib/voice/prime";
import type { Action } from "../state";
import { StepHeading } from "./StepHeading";

export function WelcomeStep({ dispatch }: { dispatch: Dispatch<Action> }) {
  const words = WELCOME_LINE.split(" ");
  return (
    <section className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 pb-16 pt-10 text-center">
      <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
        <PersonaOrb size={176} state="idle" />
      </motion.div>

      <StepHeading className="mt-12 text-balance text-[34px] font-medium leading-[1.1] tracking-[-0.028em] sm:text-[46px]">
        <span className="sr-only">{WELCOME_LINE}</span>
        <span aria-hidden>
          {words.map((w, i) => (
            <motion.span
              key={i}
              className="inline-block whitespace-pre"
              initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.25 + i * 0.045, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {w}
              {i < words.length - 1 ? " " : ""}
            </motion.span>
          ))}
        </span>
      </StepHeading>

      <motion.div
        className="mt-11 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.5 }}
      >
        <Button
          size="lg"
          onClick={() => {
            // Start the mic + audio inside the click so nothing the user says early is lost.
            primeCallAudio(true);
            dispatch({ type: "startCall", mode: "voice" });
          }}
        >
          <PhoneIcon className="h-5 w-5" />
          Start a quick call
        </Button>
        <Button
          size="lg"
          variant="glass"
          onClick={() => {
            primeCallAudio(false);
            dispatch({ type: "startCall", mode: "text" });
          }}
        >
          <KeyboardIcon className="h-5 w-5" />
          Type instead
        </Button>
      </motion.div>

      <motion.p
        className="mt-7 text-[13px] leading-relaxed text-faint"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        about two minutes · you can hang up anytime · nothing happens without your yes
      </motion.p>
    </section>
  );
}
