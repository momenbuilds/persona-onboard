"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Artifact } from "@/lib/chat/protocol";
import { downloadMarkdown, downloadPdf, estimatePages } from "@/lib/pdf";
import { ChartView } from "./ChartView";
import { Markdown } from "./Markdown";

type Props = { artifact: Artifact; onClose: () => void };

/**
 * Inline preview for a chart or document. Desktop: a panel beside the chat
 * (the chat column shrinks). Mobile: a sheet from the bottom.
 */
export function ArtifactPanel({ artifact, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = artifact.kind === "doc" ? artifact.doc.title : artifact.chart.title;
  const meta =
    artifact.kind === "doc"
      ? artifact.doc.format === "pdf"
        ? `PDF · ${estimatePages(artifact.doc.markdown)} page${estimatePages(artifact.doc.markdown) > 1 ? "s" : ""}`
        : "Markdown"
      : `${artifact.chart.type} chart · ${artifact.chart.labels.length} points`;

  return (
    <motion.aside
      role="dialog"
      aria-label={`Preview: ${title}`}
      initial={{ opacity: 0, x: 40, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      className="glass-card fixed inset-x-2 bottom-2 top-16 z-50 flex flex-col overflow-hidden rounded-[28px] lg:static lg:inset-auto lg:z-auto lg:h-full"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline bg-white/70 px-4 py-3 backdrop-blur-xl">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-[-0.01em]">{title}</p>
          <p className="text-[12px] text-muted">{meta}</p>
        </div>
        {artifact.kind === "doc" ? (
          <div className="order-last flex w-full items-center justify-end gap-1 sm:order-none sm:w-auto">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(artifact.doc.markdown).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              }}
              className="rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:bg-black/[0.05] hover:text-ink"
            >
              {copied ? "copied" : "copy"}
            </button>
            <button
              type="button"
              onClick={() => downloadMarkdown(artifact.doc)}
              className="rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:bg-black/[0.05] hover:text-ink"
            >
              .md
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await downloadPdf(artifact.doc).finally(() => setBusy(false));
              }}
              className="ink-glass rounded-full px-3.5 py-1.5 text-[13px] font-medium disabled:opacity-60"
            >
              {busy ? "making pdf…" : "download pdf"}
            </button>
          </div>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink-soft transition-colors hover:bg-ink hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto bg-surface/60 p-3 sm:p-6">
        {artifact.kind === "doc" ? (
          <motion.article
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, type: "spring", stiffness: 260, damping: 30 }}
            className="mx-auto max-w-[680px] rounded-[18px] bg-white px-6 py-8 text-[14.5px] shadow-[0_1px_2px_rgb(0_0_0/0.05),0_24px_48px_-32px_rgb(0_0_0/0.4)] sm:px-12 sm:py-12"
          >
            <Markdown text={artifact.doc.markdown} variant="page" />
          </motion.article>
        ) : (
          <div className="mx-auto max-w-[720px] rounded-[18px] bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.05)]">
            {artifact.chart.subtitle ? <p className="mb-3 text-[13px] text-muted">{artifact.chart.subtitle}</p> : null}
            <ChartView chart={artifact.chart} height={300} />
            <div className="mt-6 overflow-x-auto rounded-xl border border-black/[0.07]">
              <table className="w-full text-[13px]">
                <thead className="bg-surface">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold"> </th>
                    {artifact.chart.series.map((s) => (
                      <th key={s.name} className="px-3 py-2 text-right font-semibold">
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {artifact.chart.labels.map((l, i) => (
                    <tr key={l + i} className="border-t border-black/[0.05]">
                      <td className="px-3 py-1.5 text-ink-soft">{l}</td>
                      {artifact.chart.series.map((s) => (
                        <td key={s.name} className="px-3 py-1.5 text-right tabular-nums">
                          {s.values[i]}
                          {artifact.chart.unit && artifact.chart.unit.length <= 2 ? artifact.chart.unit : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
