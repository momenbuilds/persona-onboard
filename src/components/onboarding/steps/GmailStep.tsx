"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useState, type Dispatch } from "react";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon, CheckIcon, MailIcon, ShieldIcon, BellIcon } from "@/components/ui/icons";
import { connectGmailMock } from "@/lib/demo/gmail-mock";
import { prefetchInbox } from "@/lib/demo/inbox-prefetch";
import { templateInbox } from "@/lib/demo/template-inbox";
import type { InboxEmail } from "@/lib/schema";
import type { Action, OnboardingState } from "../state";
import { StepHeading } from "./StepHeading";

type Props = { state: OnboardingState; dispatch: Dispatch<Action> };

const POINTS = [
  { icon: MailIcon, text: "spots what's waiting on a reply" },
  { icon: BellIcon, text: "picks up bookings, dates and deadlines" },
  { icon: ShieldIcon, text: "nothing gets sent without your yes" },
];

/**
 * Gmail connection — DEMO MOCK. See src/lib/demo/gmail-mock.ts:
 * no OAuth, no Google permissions, no network calls.
 */
export function GmailStep({ state, dispatch }: Props) {
  const [phase, setPhase] = useState<"idle" | "connecting" | "connected">(state.gmail === "connected" ? "connected" : "idle");
  const [label, setLabel] = useState("");

  async function connect() {
    setPhase("connecting");
    // DEMO: no Google access. While the mock "connects", build a sample inbox from
    // the user's own onboarding answers so the dashboard has something to work with.
    // It was usually started on the summary screen, so this is normally instant.
    const u = state.understanding;
    const inbox = u
      ? prefetchInbox({
          userName: state.userName,
          summary: u.summary,
          primaryGoal: u.primaryGoal,
          secondaryGoals: u.secondaryGoals,
          notes: state.notes,
        })
      : Promise.resolve([] as InboxEmail[]);
    // Whenever it lands (even after this step), it fills the dashboard's inbox,
    // unless the user has already started chatting about the template's emails.
    let landed = false;
    void inbox.then((emails) => {
      landed = true;
      if (emails.length) dispatch({ type: "setInbox", inbox: emails, ifUnused: true });
    });
    await connectGmailMock((stage, text) => {
      if (stage !== "connected") setLabel(text);
    });
    setLabel("reading what's in motion…");
    // Never hold the step for long: show what's ready after a few seconds at most.
    await Promise.race([inbox, new Promise((r) => setTimeout(r, 2500))]);
    // Never an empty inbox: the template (with a deck about their goal) covers the gap.
    if (!landed && u && !state.inbox.length) {
      dispatch({
        type: "setInbox",
        inbox: templateInbox({ userName: state.userName, summary: u.summary, primaryGoal: u.primaryGoal, secondaryGoals: u.secondaryGoals }),
      });
    }
    setPhase("connected");
    dispatch({ type: "setGmail", status: "connected" });
  }

  return (
    <section className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-6 pb-20 pt-12 text-center sm:pt-20">
      <div className="relative">
        <motion.div
          className="liquid-glass flex h-24 w-24 items-center justify-center rounded-[28px]"
          animate={phase === "connecting" ? { rotate: [0, -4, 4, 0] } : { rotate: 0 }}
          transition={phase === "connecting" ? { duration: 1.2, repeat: Infinity } : {}}
        >
          <Image src="/brand/gmail.svg" alt="" width={48} height={36} unoptimized />
        </motion.div>
        <AnimatePresence>
          {phase === "connected" ? (
            <motion.span
              key="ok"
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-ios-green text-white shadow-[0_6px_16px_-4px_rgb(48_209_88/0.7)] ring-4 ring-white"
            >
              <CheckIcon className="h-5 w-5" />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      <StepHeading className="mt-10 text-balance text-[28px] font-medium leading-[1.15] tracking-[-0.03em] sm:text-[36px]">
        {phase === "connected" ? "Gmail connected." : "connect Gmail so Persona can understand the things you already have going on."}
      </StepHeading>

      {phase === "connected" ? (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 text-[16px] text-muted"
          role="status"
        >
          {state.agentName || "Persona"} will read what&apos;s already in motion and only ask you when it matters.
        </motion.p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3 text-left">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-[16px] text-ink-soft">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ios-blue">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      )}

      {phase === "connected" && state.inbox.length ? (
        <motion.ul
          className="glass-card mt-7 w-full overflow-hidden rounded-[24px] text-left"
          aria-label="Demo inbox"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } } }}
        >
          <li className="flex items-center justify-between border-b border-hairline px-4 py-2.5 text-[12px] text-faint">
            <span>found in your inbox</span>
            <span className="rounded-full bg-surface px-2 py-0.5 font-medium">demo data</span>
          </li>
          {state.inbox.slice(0, 4).map((m) => (
            <motion.li
              key={m.id}
              variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
              className="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-0"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-[13px] font-semibold text-ink-soft">
                {m.from.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{m.subject}</span>
                <span className="block truncate text-[12.5px] text-muted">
                  {m.from} · {m.date}
                  {m.attachment ? ` · 📎 ${m.attachment.name}` : ""}
                </span>
              </span>
            </motion.li>
          ))}
        </motion.ul>
      ) : null}

      <div className="mt-11 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:items-center">
        {phase === "connected" ? (
          <Button size="lg" onClick={() => dispatch({ type: "go", step: "ready" })} autoFocus>
            Continue <ArrowRightIcon className="h-5 w-5" />
          </Button>
        ) : (
          <>
            <Button size="lg" variant="glass" onClick={connect} disabled={phase === "connecting"} aria-busy={phase === "connecting"}>
              {phase === "connecting" ? (
                <>
                  <Spinner /> <span aria-live="polite">{label}</span>
                </>
              ) : (
                <>
                  <Image src="/brand/gmail.svg" alt="" width={20} height={15} unoptimized /> Connect Gmail
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={phase === "connecting"}
              onClick={() => {
                dispatch({ type: "setGmail", status: "skipped" });
                dispatch({ type: "go", step: "ready" });
              }}
            >
              Skip for now
            </Button>
          </>
        )}
      </div>

      <p className="mt-8 text-[12px] text-faint">demo connection: no Google account is accessed in this preview.</p>
    </section>
  );
}

function Spinner() {
  return <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />;
}
