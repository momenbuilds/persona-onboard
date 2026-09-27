"use client";

import { motion } from "framer-motion";
import type { Artifact, ChartSpec, DocSpec } from "@/lib/chat/protocol";
import { estimatePages } from "@/lib/pdf";
import type { Reminder } from "@/lib/schema";
import { ChartView } from "./ChartView";

function FileTile({ format }: { format: DocSpec["format"] }) {
  const pdf = format === "pdf";
  return (
    <span
      className={`relative flex h-11 w-9 shrink-0 items-end justify-center rounded-[7px] pb-1 text-[8.5px] font-bold tracking-wide text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_4px_10px_-4px_rgb(0_0_0/0.35)] ${
        pdf ? "bg-gradient-to-b from-[#ff5b4f] to-[#e0342a]" : "bg-gradient-to-b from-[#48484a] to-[#1d1d1f]"
      }`}
    >
      {/* folded corner */}
      <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-bl-[4px] bg-white/35" />
      {pdf ? "PDF" : "MD"}
    </span>
  );
}

export function DocCard({ doc, onOpen }: { doc: DocSpec; onOpen: () => void }) {
  const pages = estimatePages(doc.markdown);
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      layout
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className="group flex w-full max-w-[360px] items-center gap-3 rounded-2xl border border-black/[0.07] bg-white p-3 pr-4 text-left shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_28px_-18px_rgb(0_0_0/0.35)]"
      aria-label={`Open ${doc.title}`}
    >
      <FileTile format={doc.format} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold tracking-[-0.01em] text-ink">{doc.title}</span>
        <span className="block text-[12.5px] text-muted">
          {doc.format === "pdf" ? `PDF · ${pages} page${pages > 1 ? "s" : ""}` : `Markdown · ${Math.max(1, Math.round(doc.markdown.length / 1000))} KB`} · tap to preview
        </span>
      </span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-ink-soft transition-colors group-hover:bg-ink group-hover:text-white">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d="M8 16 16 8M10 8h6v6" />
        </svg>
      </span>
    </motion.button>
  );
}

export function ChartCard({ chart, onOpen }: { chart: ChartSpec; onOpen: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="w-full max-w-[560px] rounded-[22px] border border-black/[0.07] bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_36px_-24px_rgb(0_0_0/0.35)]"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-[-0.01em]">{chart.title}</p>
          {chart.subtitle ? <p className="truncate text-[12.5px] text-muted">{chart.subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Expand chart: ${chart.title}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-ink-soft transition-colors hover:bg-ink hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
          </svg>
        </button>
      </div>
      <ChartView chart={chart} height={200} />
    </motion.div>
  );
}

/** Shown the moment a chart/document starts streaming, until it's complete. */
export function ArtifactSkeleton({ kind }: { kind: "chart" | "doc" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-3 ${kind === "doc" ? "w-full max-w-[360px]" : "w-full max-w-[560px]"}`}
    >
      <div className="flex items-center gap-3">
        <span className={`h-11 w-9 rounded-[7px] ${kind === "doc" ? "bg-[#ff5b4f]/25" : "bg-surface"}`} />
        <span className="flex-1 space-y-2">
          <span className="block h-3 w-2/3 rounded-full bg-surface" />
          <span className="block h-2.5 w-1/3 rounded-full bg-surface" />
        </span>
        <span className="text-[12px] text-muted">{kind === "doc" ? "writing document…" : "drawing chart…"}</span>
      </div>
      {kind === "chart" ? (
        <div className="mt-3 flex h-24 items-end gap-2">
          {[40, 70, 55, 90, 65, 80].map((h, i) => (
            <motion.span
              key={i}
              className="flex-1 rounded-md bg-surface"
              animate={{ height: [`${h * 0.5}%`, `${h}%`, `${h * 0.5}%`] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.1 }}
            />
          ))}
        </div>
      ) : null}
      <motion.span
        aria-hidden
        className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent"
        animate={{ x: ["-120%", "320%"] }}
        transition={{ duration: 1.3, repeat: Infinity, ease: "linear" }}
      />
    </motion.div>
  );
}

export function ReminderPill({ reminder }: { reminder: Reminder }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 28 }}
      className="inline-flex items-center gap-2 rounded-full bg-surface py-1.5 pl-1.5 pr-3 text-[12.5px]"
    >
      <motion.span
        initial={{ rotate: -90, scale: 0 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 500, damping: 20 }}
        className="flex h-5 w-5 items-center justify-center rounded-full bg-ios-green text-white"
      >
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden>
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </motion.span>
      <span className="font-medium text-ink">Reminder set</span>
      <span className="text-muted">
        {reminder.title} · {reminder.when}
      </span>
    </motion.div>
  );
}

export function ArtifactView({ artifact, onOpen }: { artifact: Artifact; onOpen: () => void }) {
  return artifact.kind === "doc" ? <DocCard doc={artifact.doc} onOpen={onOpen} /> : <ChartCard chart={artifact.chart} onOpen={onOpen} />;
}
