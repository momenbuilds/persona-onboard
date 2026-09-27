import { z } from "zod";
import { ReminderSchema } from "@/lib/schema";

/** A chart the assistant can draw inline (rendered as animated SVG, no chart library). */
export const ChartSpecSchema = z.object({
  type: z.enum(["bar", "line", "area", "pie", "donut"]),
  title: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().max(140).optional(),
  unit: z.string().trim().max(12).optional(),
  labels: z.array(z.string().trim().max(28)).min(1).max(24),
  series: z
    .array(z.object({ name: z.string().trim().min(1).max(40), values: z.array(z.number().finite()).min(1).max(24) }))
    .min(1)
    .max(4),
  stats: z.array(z.object({ label: z.string().trim().max(32), value: z.string().trim().max(18) })).max(4).optional(),
});
export type ChartSpec = z.infer<typeof ChartSpecSchema>;

/** A document the assistant wrote on request, previewed inline and downloadable as PDF/Markdown. */
export const DocSpecSchema = z.object({
  title: z.string().trim().min(1).max(100),
  format: z.enum(["pdf", "md"]),
  markdown: z.string().min(1).max(40_000),
});
export type DocSpec = z.infer<typeof DocSpecSchema>;

export type Artifact =
  | { kind: "chart"; id: string; chart: ChartSpec }
  | { kind: "doc"; id: string; doc: DocSpec };

/** Streamed from /api/chat as newline-delimited JSON. */
export type ChatEvent =
  | { t: "delta"; v: string }
  /** A chart/document block started — show a skeleton while it's written. */
  | { t: "artifact-start"; kind: "chart" | "doc"; title?: string }
  | { t: "artifact"; artifact: Artifact }
  | { t: "reminder"; reminder: z.infer<typeof ReminderSchema> }
  | { t: "done"; source: "deepseek" | "fallback" }
  | { t: "error"; message: string };

/** The user explicitly asked for a file. Documents are only created when this is true. */
export function wantsDocument(text: string) {
  if (/\b(pdf|markdown)\b|\.md\b|\bmd file\b/i.test(text)) return true;
  const verb = /\b(create|make|write|draft|generate|export|prepare|build|put together|turn|give me|save)\b/i.test(text);
  const noun = /\b(document|doc|file|report|one[- ]pager|brief|write[- ]?up|handout|memo|deck|slides?|agenda|proposal|summary doc)\b/i.test(text);
  return verb && noun;
}

export function wantsChart(text: string) {
  return /\b(chart|graph|plot|visuali[sz]e|trend|breakdown|compare|comparison|distribution|pie|bar|histogram|over time)\b/i.test(text);
}

export function wantsMath(text: string) {
  return /(\b(solve|calculate|compute|equation|integral|derivative|probability|percent|percentage|interest|formula|proof|math)\b|\d\s*[+\-*/x×÷^%]\s*\d)/i.test(text);
}
