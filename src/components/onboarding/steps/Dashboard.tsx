"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { ArtifactPanel } from "@/components/chat/ArtifactPanel";
import { ArtifactSkeleton, ArtifactView, ReminderPill } from "@/components/chat/ArtifactCard";
import { Markdown } from "@/components/chat/Markdown";
import { useChatStream, type LiveReply } from "@/components/chat/useChatStream";
import { PersonaOrb } from "@/components/orb/PersonaOrb";
import { ArrowUpIcon, CheckIcon, PlusIcon } from "@/components/ui/icons";
import type { Artifact } from "@/lib/chat/protocol";
import type { ChatMessage, ChatRequest } from "@/lib/schema";
import { createLevelSource, syntheticSpeech } from "@/lib/voice/level";
import { uid, type Action, type DashMessage, type OnboardingState } from "../state";
import { StepHeading } from "./StepHeading";

type Props = { state: OnboardingState; dispatch: Dispatch<Action> };

/** Message timestamps (only ever called from event handlers/effects). */
const stamp = () => Date.now();
const timeLabel = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export function Dashboard({ state, dispatch }: Props) {
  const agent = state.agentName || "Persona";
  const userName = state.userName.trim();
  const u = state.understanding;
  const { live, streaming, send, stop } = useChatStream();
  const [open, setOpen] = useState<Artifact | null>(null);
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const userScroll = useRef(0);
  const [showJump, setShowJump] = useState(false);
  const level = useMemo(() => createLevelSource(), []);

  // Greeting (once).
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || state.chat.length > 0) return;
    seeded.current = true;
    const added = state.reminders.filter((r) => r.added);
    const lines = [
      `hey ${userName || "there"}! it's ${agent}. i'm all set up.`,
      `here's what i know so far: ${u?.summary ?? "you want a hand keeping life moving."}`,
      added.length
        ? `i've added ${added.length} reminder${added.length > 1 ? "s" : ""}: ${added.map((r) => r.title.toLowerCase()).join(", ")}. ask me anything, or pick one of the ideas below.`
        : `ask me anything: plans, math, charts, or a doc from your inbox. ideas below.`,
    ];
    const now = stamp();
    lines.forEach((text) => dispatch({ type: "addChat", message: { id: uid(), role: "persona", text, at: now } }));
  }, [agent, userName, u, state.chat.length, state.reminders, dispatch]);

  // Orb reacts while the agent is "typing".
  useEffect(() => {
    level.set(streaming ? syntheticSpeech() : null);
  }, [streaming, level]);

  // Stick to the bottom only if the reader is already there.
  const scrollToEnd = useCallback((force = false) => {
    const el = scroller.current;
    if (el && (force || atBottom.current)) el.scrollTop = el.scrollHeight;
  }, []);
  useEffect(() => scrollToEnd(), [state.chat.length, live, scrollToEnd]);
  // Cards, charts and markdown grow after they mount: stay pinned while they do.
  const thread = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = thread.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => scrollToEnd());
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollToEnd]);

  const suggestions = useMemo(() => {
    const deck = state.inbox.find((m) => m.attachment?.kind === "deck");
    const s = [
      deck ? `turn the deck in my email into a pdf one-pager` : `write me a one-page plan for ${u?.primaryGoal?.toLowerCase() ?? "this week"} as a pdf`,
      `chart how my week looks`,
      `plan my tomorrow around ${u?.primaryGoal?.toLowerCase() ?? "my top goal"}`,
      state.inbox.length ? `what in my inbox needs me first?` : `what should i focus on first this week?`,
      `if i save $400 a month at 4%, what do i have in 3 years?`,
    ];
    return s;
  }, [state.inbox, u?.primaryGoal]);

  function toServerHistory(extra: DashMessage): ChatMessage[] {
    return [...state.chat.filter((m) => !m.failed), extra].map((m) => ({
      id: m.id,
      role: m.role,
      text:
        m.text +
        (m.artifacts?.length
          ? `\n${m.artifacts.map((a) => (a.kind === "doc" ? `[shared a ${a.doc.format.toUpperCase()}: ${a.doc.title}]` : `[shared a ${a.chart.type} chart: ${a.chart.title}]`)).join("\n")}`
          : ""),
    }));
  }

  async function submit(raw: string) {
    const text = raw.trim().slice(0, 4000);
    if (!text || streaming) return;
    setDraft("");
    atBottom.current = true;
    const userMessage: DashMessage = { id: uid(), role: "user", text, via: "text", at: stamp() };
    dispatch({ type: "addChat", message: userMessage });
    requestAnimationFrame(() => scrollToEnd(true));

    const req: ChatRequest = {
      messages: toServerHistory(userMessage).slice(-40),
      profile: {
        userName,
        agentName: agent,
        summary: u?.summary ?? "",
        primaryGoal: u?.primaryGoal ?? "",
        secondaryGoals: u?.secondaryGoals ?? [],
        reminders: state.reminders.map(({ title, when, added }) => ({ title, when, added })),
        gmail: state.gmail,
        notes: state.notes,
        inbox: state.inbox.slice(0, 8),
      },
      now: {
        label: new Date().toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" }),
      },
    };
    const final = await send(req);
    if (final.reminder) dispatch({ type: "addReminder", reminder: final.reminder });
    if (!final.text && !final.artifacts.length) {
      if (final.stopped) return;
      dispatch({ type: "addChat", message: { id: uid(), role: "persona", text: "i couldn't reach the server just now.", failed: true, at: stamp() } });
      return;
    }
    dispatch({
      type: "addChat",
      message: {
        id: uid(),
        role: "persona",
        text: final.text + (final.stopped ? " …" : ""),
        artifacts: final.artifacts.length ? final.artifacts : undefined,
        reminderSet: final.reminder,
        at: stamp(),
      },
    });
    const newDoc = final.artifacts.find((a) => a.kind === "doc");
    if (newDoc) setOpen(newDoc);
  }

  function retryLast() {
    const lastUser = [...state.chat].reverse().find((m) => m.role === "user");
    if (lastUser) void submit(lastUser.text);
  }

  const firstAt = state.chat[0]?.at;

  return (
    <LayoutGroup>
      <section
        // Desktop: exactly one screen tall (under the 64px header). flex-none + a minmax(0,1fr) row
        // keep a long sidebar or chat scrolling inside their cards instead of stretching the page
        // and pushing the composer below the fold.
        className={`mx-auto grid w-full max-w-[1440px] flex-1 gap-4 px-3 pb-3 pt-4 sm:px-6 lg:h-[calc(100dvh-64px)] lg:flex-none lg:grid-rows-[minmax(0,1fr)] ${
          open ? "lg:grid-cols-[minmax(0,1fr)_minmax(440px,46%)]" : "lg:grid-cols-[300px_minmax(0,1fr)]"
        }`}
      >
        <StepHeading className="sr-only">
          {agent}&apos;s dashboard for {userName || "you"}
        </StepHeading>

        <AnimatePresence initial={false}>
          {!open ? (
            <motion.div
              key="side"
              layout
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="order-2 min-h-0 lg:order-1"
            >
              <Sidebar state={state} dispatch={dispatch} agent={agent} onAsk={(t) => setDraft(t)} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.div
          layout
          transition={{ type: "spring", stiffness: 300, damping: 34 }}
          className="glass-card relative order-1 flex h-[calc(100dvh-104px)] min-h-[560px] flex-col overflow-hidden rounded-[32px] lg:order-2 lg:h-full lg:min-h-0"
        >
          {/* header */}
          <div className="flex items-center gap-3 border-b border-hairline bg-white/60 px-5 py-3 backdrop-blur-xl">
            <PersonaOrb size={38} state={streaming ? "speaking" : "idle"} level={level} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold tracking-[-0.01em]">{agent}</p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={streaming ? "typing" : "online"}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  className="text-[12px] text-muted"
                >
                  {streaming ? (live?.pending.length ? (live.pending[0] === "doc" ? "writing a document…" : "drawing a chart…") : "typing…") : "online · knows your week"}
                </motion.p>
              </AnimatePresence>
            </div>
            {state.inbox.length ? (
              <span className="hidden rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-medium text-muted sm:inline">
                Gmail · demo inbox
              </span>
            ) : null}
          </div>

          {/* thread */}
          <div
            ref={scroller}
            role="log"
            aria-live="polite"
            aria-label={`Chat with ${agent}`}
            // Only a real user scroll can un-pin the thread; growing content never does.
            onWheel={() => (userScroll.current = performance.now())}
            onTouchMove={() => (userScroll.current = performance.now())}
            onKeyDown={() => (userScroll.current = performance.now())}
            onScroll={(e) => {
              const el = e.currentTarget;
              const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              if (bottom) atBottom.current = true;
              else if (performance.now() - userScroll.current < 400) atBottom.current = false;
              setShowJump(!atBottom.current);
            }}
            className="relative flex-1 overflow-y-auto px-3 py-5 sm:px-6"
          >
            <p className="mb-4 text-center text-[11px] font-medium text-faint">iMessage · Today{firstAt ? ` ${timeLabel(firstAt)}` : ""}</p>
            <div ref={thread} className="mx-auto flex max-w-[780px] flex-col gap-1.5">
              {state.chat.map((m, i) => (
                <MessageRow
                  key={m.id}
                  message={m}
                  agent={agent}
                  tail={state.chat[i + 1]?.role !== m.role}
                  onOpen={setOpen}
                  onRetry={m.failed ? retryLast : undefined}
                />
              ))}
              {live ? <LiveRow live={live} agent={agent} /> : null}
            </div>
          </div>

          <AnimatePresence>
            {showJump ? (
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.9 }}
                onClick={() => scrollToEnd(true)}
                aria-label="Jump to latest"
                className="liquid-glass absolute bottom-[132px] left-1/2 z-10 -ml-[18px] flex h-9 w-9 items-center justify-center rounded-full"
              >
                <ArrowUpIcon className="h-4 w-4 rotate-180" />
              </motion.button>
            ) : null}
          </AnimatePresence>

          {/* suggestions + composer */}
          <div className="relative border-t border-hairline bg-white/50 px-3 pb-3 pt-2.5 backdrop-blur-xl sm:px-5">
            <AnimatePresence initial={false}>
              {!streaming ? (
                <motion.div
                  key="chips"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="no-scrollbar -mx-1 mb-2 flex gap-2 overflow-x-auto px-1"
                >
                  {suggestions.map((s, i) => (
                    <motion.button
                      key={s}
                      type="button"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * i }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => void submit(s)}
                      className="shrink-0 rounded-full bg-surface px-3.5 py-1.5 text-[13px] text-ink-soft transition-colors hover:bg-ink hover:text-white"
                    >
                      {s}
                    </motion.button>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>
            <ChatComposer value={draft} onChange={setDraft} onSend={(t) => void submit(t)} onStop={stop} streaming={streaming} agent={agent} />
          </div>
        </motion.div>

        <AnimatePresence>
          {open ? (
            <motion.div key="panel" layout className="order-3 min-h-0">
              <ArtifactPanel artifact={open} onClose={() => setOpen(null)} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>
    </LayoutGroup>
  );
}

/* ------------------------------------------------------------------ */

const MessageRow = memo(function MessageRow({
  message: m,
  agent,
  tail,
  onOpen,
  onRetry,
}: {
  message: DashMessage;
  agent: string;
  tail: boolean;
  onOpen: (a: Artifact) => void;
  onRetry?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const mine = m.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      style={{ originX: mine ? 1 : 0, originY: 1 }}
      className={`group flex flex-col gap-2 ${mine ? "items-end" : "items-start"} ${tail ? "mb-1.5" : ""}`}
    >
      {m.text ? (
        <div
          className={`relative max-w-[88%] rounded-[20px] px-4 py-2.5 text-[15.5px] leading-[1.42] sm:max-w-[80%] ${
            mine ? "imsg-me whitespace-pre-wrap text-white" : m.failed ? "bg-ios-red/[0.08] text-ink" : "bg-bubble-gray text-ink"
          }`}
        >
          <span className="sr-only">{mine ? "You: " : `${agent}: `}</span>
          {mine ? m.text : <Markdown text={m.text} />}
          {tail ? (
            <svg
              aria-hidden
              viewBox="0 0 12 16"
              className={`absolute bottom-0 h-[14px] w-[10px] ${mine ? "-right-[4px] text-[#0088ff]" : `-left-[4px] -scale-x-100 ${m.failed ? "text-[#fdecea]" : "text-bubble-gray"}`}`}
            >
              <path fill="currentColor" d="M0 0v10c0 3.3 2.7 6 6 6h6C8 16 4 13 4 8V0H0Z" />
            </svg>
          ) : null}
        </div>
      ) : null}
      {m.artifacts?.map((a) => <ArtifactView key={a.id} artifact={a} onOpen={() => onOpen(a)} />)}
      {m.reminderSet ? <ReminderPill reminder={m.reminderSet} /> : null}
      {onRetry ? (
        <button type="button" onClick={onRetry} className="px-2 text-[12.5px] font-medium text-ios-blue">
          try again
        </button>
      ) : !mine && m.text ? (
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(m.text).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="-mt-1 px-2 text-[11.5px] text-faint opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        >
          {copied ? "copied" : "copy"}
        </button>
      ) : null}
    </motion.div>
  );
});

function LiveRow({ live, agent }: { live: LiveReply; agent: string }) {
  const idle = !live.text && !live.pending.length && !live.artifacts.length;
  return (
    <div className="flex flex-col items-start gap-2" aria-busy>
      {idle ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1 rounded-[20px] bg-bubble-gray px-4 py-3"
          aria-label={`${agent} is typing`}
        >
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-faint"
              animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </motion.div>
      ) : null}
      {live.text ? (
        <div className="max-w-[88%] rounded-[20px] bg-bubble-gray px-4 py-2.5 text-[15.5px] leading-[1.42] text-ink sm:max-w-[80%]">
          <Markdown text={live.text} />
          <motion.span
            aria-hidden
            className="ml-0.5 inline-block h-3.5 w-[3px] translate-y-0.5 rounded-full bg-ink/50"
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 0.9, repeat: Infinity }}
          />
        </div>
      ) : null}
      {live.artifacts.map((a) => (
        <ArtifactView key={a.id} artifact={a} onOpen={() => {}} />
      ))}
      <AnimatePresence>
        {live.pending.map((k, i) => (
          <ArtifactSkeleton key={`${k}-${i}`} kind={k} />
        ))}
      </AnimatePresence>
      {live.reminder ? <ReminderPill reminder={live.reminder} /> : null}
    </div>
  );
}

function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  agent,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: (t: string) => void;
  onStop: () => void;
  streaming: boolean;
  agent: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);
  useEffect(() => {
    if (value) ref.current?.focus();
  }, [value]);

  const canSend = value.trim().length > 0 && !streaming;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSend(value);
      }}
      className="liquid-glass flex items-end gap-2 rounded-[26px] py-1.5 pl-4 pr-1.5 transition-shadow focus-within:shadow-[0_0_0_3px_rgb(10_132_255/0.18),0_10px_34px_#00000012]"
    >
      <label htmlFor="dash-composer" className="sr-only">
        Message {agent}
      </label>
      <textarea
        id="dash-composer"
        ref={ref}
        rows={1}
        value={value}
        maxLength={4000}
        placeholder={`Message ${agent}`}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (canSend) onSend(value);
          } else if (e.key === "Escape" && streaming) onStop();
        }}
        className="max-h-40 min-h-[38px] flex-1 resize-none bg-transparent py-2 text-[16px] leading-[22px] text-ink outline-none placeholder:text-faint focus-visible:outline-none"
      />
      <AnimatePresence mode="popLayout" initial={false}>
        {streaming ? (
          <motion.button
            key="stop"
            type="button"
            onClick={onStop}
            aria-label="Stop"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            className="mb-0.5 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-ink text-white"
          >
            <span className="h-3 w-3 rounded-[3px] bg-white" />
          </motion.button>
        ) : (
          <motion.button
            key="send"
            type="submit"
            aria-label="Send"
            disabled={!canSend}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            whileTap={{ scale: 0.88 }}
            className="mb-0.5 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-ios-blue text-white transition-opacity disabled:opacity-30"
          >
            <ArrowUpIcon className="h-[18px] w-[18px]" />
          </motion.button>
        )}
      </AnimatePresence>
    </form>
  );
}

function Sidebar({
  state,
  dispatch,
  agent,
  onAsk,
}: {
  state: OnboardingState;
  dispatch: Dispatch<Action>;
  agent: string;
  onAsk: (text: string) => void;
}) {
  const u = state.understanding;
  const userName = state.userName.trim();
  return (
    <aside className="glass-card flex h-full flex-col gap-6 overflow-y-auto rounded-[30px] p-5">
      <div className="flex items-center gap-3.5">
        <PersonaOrb size={52} />
        <div>
          <p className="text-[21px] font-medium tracking-[-0.02em]">{agent}</p>
          <p className="text-[12.5px] text-muted">your Persona · active</p>
        </div>
      </div>

      <section>
        <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-faint">About {userName || "you"}</h2>
        <p className="mt-2 text-[14.5px] leading-snug">{u?.summary}</p>
        {u ? (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Goals">
            {[u.primaryGoal, ...u.secondaryGoals].map((g, i) => (
              <li key={g} className={`rounded-full px-2.5 py-1 text-[12px] ${i === 0 ? "bg-ink text-white" : "bg-surface text-ink-soft"}`}>
                {g}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-faint">Reminders</h2>
        <ul className="mt-2 flex flex-col gap-1.5">
          <AnimatePresence initial={false}>
            {state.reminders.map((r, i) => (
              <motion.li key={`${r.title}-${i}`} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                <div className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${r.added ? "bg-surface" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[14px] ${r.added ? "font-medium text-ink" : "text-faint line-through decoration-faint/40"}`}>{r.title}</p>
                    <p className="text-[12px] text-muted">{r.added ? r.when : "skipped"}</p>
                  </div>
                  <button
                    type="button"
                    aria-pressed={r.added}
                    aria-label={r.added ? `Turn off reminder: ${r.title}` : `Add reminder: ${r.title}`}
                    onClick={() => dispatch({ type: "toggleReminder", index: i })}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${r.added ? "bg-ink text-white" : "liquid-glass text-ink"}`}
                  >
                    {r.added ? <CheckIcon className="h-3.5 w-3.5" /> : <PlusIcon className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </section>

      {state.inbox.length ? (
        <section>
          <h2 className="flex items-center justify-between text-[11.5px] font-semibold uppercase tracking-[0.07em] text-faint">
            Inbox <span className="rounded-full bg-surface px-2 py-0.5 text-[10.5px] normal-case tracking-normal">demo data</span>
          </h2>
          <ul className="mt-2 flex flex-col gap-0.5">
            {state.inbox.slice(0, 6).map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onAsk(m.attachment ? `turn “${m.attachment.name}” from ${m.from} into a pdf` : `summarize the email “${m.subject}” and draft a reply`)}
                  className="w-full rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-black/[0.04]"
                >
                  <p className="truncate text-[13.5px] font-medium">{m.subject}</p>
                  <p className="truncate text-[12px] text-muted">
                    {m.from} · {m.date}
                    {m.attachment ? " · 📎" : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-auto flex items-center gap-2 text-[12.5px] text-muted">
        <span className={`h-1.5 w-1.5 rounded-full ${state.gmail === "connected" ? "bg-ios-green" : "bg-faint"}`} />
        Gmail {state.gmail === "connected" ? "connected (demo)" : "not connected"}
      </p>
    </aside>
  );
}
