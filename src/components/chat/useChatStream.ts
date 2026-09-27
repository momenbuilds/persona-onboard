"use client";

import { useCallback, useRef, useState } from "react";
import type { Artifact, ChatEvent } from "@/lib/chat/protocol";
import type { ChatRequest, Reminder } from "@/lib/schema";

export type LiveReply = {
  text: string;
  /** Charts/documents currently being written (skeletons). */
  pending: ("chart" | "doc")[];
  artifacts: Artifact[];
  reminder?: Reminder;
};

export type FinalReply = LiveReply & { source: "deepseek" | "fallback" | "local"; failed?: boolean; stopped?: boolean };

/**
 * Streams /api/chat. Text deltas are batched and flushed at most every ~40ms
 * (one React render per batch, not per token), so long replies stay smooth.
 */
export function useChatStream() {
  const [live, setLive] = useState<LiveReply | null>(null);
  const abort = useRef<AbortController | null>(null);
  const stopped = useRef(false);

  const send = useCallback(async (req: ChatRequest): Promise<FinalReply> => {
    const reply: LiveReply = { text: "", pending: [], artifacts: [] };
    let source: FinalReply["source"] = "local";
    let failed = false;
    let lastFlush = 0;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      flushTimer = null;
      lastFlush = performance.now();
      setLive({ ...reply, pending: [...reply.pending], artifacts: [...reply.artifacts] });
    };
    const schedule = (now = false) => {
      if (now) {
        if (flushTimer) clearTimeout(flushTimer);
        flush();
      } else if (!flushTimer) {
        flushTimer = setTimeout(flush, Math.max(0, 40 - (performance.now() - lastFlush)));
      }
    };

    stopped.current = false;
    abort.current = new AbortController();
    setLive(reply);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
        signal: abort.current.signal,
      });
      if (!res.ok || !res.body) throw new Error(String(res.status));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const e = JSON.parse(line) as ChatEvent;
          if (e.t === "delta") {
            reply.text += e.v;
            schedule();
          } else if (e.t === "artifact-start") {
            reply.pending.push(e.kind);
            schedule(true);
          } else if (e.t === "artifact") {
            const i = reply.pending.indexOf(e.artifact.kind);
            if (i >= 0) reply.pending.splice(i, 1);
            reply.artifacts.push(e.artifact);
            schedule(true);
          } else if (e.t === "reminder") {
            reply.reminder = e.reminder;
            schedule(true);
          } else if (e.t === "done") {
            source = e.source;
          } else if (e.t === "error") {
            failed = true;
          }
        }
      }
    } catch {
      if (!stopped.current) failed = true;
    } finally {
      if (flushTimer) clearTimeout(flushTimer);
      abort.current = null;
      setLive(null);
    }
    reply.pending = [];
    return { ...reply, text: reply.text.trim(), source, failed: failed && !reply.text.trim() ? true : failed, stopped: stopped.current };
  }, []);

  const stop = useCallback(() => {
    stopped.current = true;
    abort.current?.abort();
  }, []);

  return { live, streaming: live !== null, send, stop };
}
