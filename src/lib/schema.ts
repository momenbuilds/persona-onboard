import { z } from "zod";

/** A single line in the onboarding call or dashboard chat. */
/**
 * Long text is trimmed, not rejected: one long reply earlier in the chat must never
 * make every later request fail. The hard ceiling still stops abuse.
 */
const clipped = (keep: number, ceiling = keep * 10) => z.string().max(ceiling).transform((s) => s.slice(0, keep));

export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["persona", "user"]),
  text: clipped(4000),
  via: z.enum(["voice", "text", "sample"]).optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ReminderSchema = z.object({
  title: z.string().trim().min(2).max(48),
  when: z.string().trim().min(2).max(40),
});
export type Reminder = z.infer<typeof ReminderSchema>;

/** Agent names: one short word (letters only, optional hyphen/space), 2–16 chars. */
export const AgentNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(16)
  .regex(/^[A-Za-z][A-Za-z' -]*[A-Za-z]$/, "Letters only");

/** One task's weekly hours, by hand vs. with Persona. */
export const TimeSavingSchema = z.object({
  task: z.string().trim().min(2).max(40),
  manualHours: z.number().min(0.25).max(15),
  withPersonaHours: z.number().min(0).max(15),
});
export type TimeSaving = z.infer<typeof TimeSavingSchema>;

/**
 * The structured understanding produced from the onboarding call —
 * by DeepSeek V4.1 Flash (via OpenRouter) or by the deterministic fallback.
 */
export const UnderstandingSchema = z.object({
  /** The user's own first name, as last stated. Empty string if never given. */
  userName: z.string().trim().max(40),
  /** One lower-case, second-person sentence. */
  summary: z.string().trim().min(10).max(280),
  primaryGoal: z.string().trim().min(3).max(120),
  secondaryGoals: z.array(z.string().trim().min(2).max(120)).max(4),
  suggestedAgentNames: z.array(AgentNameSchema).length(3),
  suggestedReminders: z.array(ReminderSchema).length(3),
  /** Weekly hours per task, by hand vs. with Persona (an estimate from the call). */
  timeSavings: z.array(TimeSavingSchema).max(5).optional(),
});
export type Understanding = z.infer<typeof UnderstandingSchema>;


export const UnderstandRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(120),
  /** What the voice agent recorded when it wrapped up (userName, needs, goals, routine, details). */
  notes: z.record(z.string(), clipped(2000)).optional(),
});

export type UnderstandingSource = "deepseek" | "fallback";

/**
 * A sample email in the DEMO inbox. Gmail is mocked: these are generated from the
 * user's own onboarding answers so the dashboard can show what Persona would do
 * with a real inbox. No Google data is ever read.
 */
export const InboxEmailSchema = z.object({
  id: z.string().max(40),
  from: z.string().trim().min(1).max(60),
  subject: z.string().trim().min(1).max(120),
  date: z.string().trim().max(40),
  snippet: z.string().trim().max(200),
  body: z.string().trim().max(2500),
  attachment: z
    .object({
      name: z.string().trim().max(80),
      kind: z.enum(["deck", "doc", "sheet", "pdf"]),
      /** The attachment's content, as plain text (e.g. slide-by-slide outline). */
      content: z.string().trim().max(4000),
    })
    .nullable()
    .optional(),
});
export type InboxEmail = z.infer<typeof InboxEmailSchema>;

/** One dashboard chat turn: history + everything the agent knows about the user. */
export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(200),
  profile: z.object({
    userName: z.string().max(40),
    agentName: z.string().min(1).max(40),
    summary: z.string().max(600),
    primaryGoal: z.string().max(200),
    secondaryGoals: z.array(z.string().max(200)).max(6),
    reminders: z.array(ReminderSchema.extend({ added: z.boolean() })).max(40),
    gmail: z.enum(["idle", "connected", "skipped"]),
    notes: z.record(z.string(), clipped(2000)).optional(),
    inbox: z.array(InboxEmailSchema).max(10).optional(),
  }),
  /** The user's local date/time, e.g. "Sunday 27 September 2026, 1:40 am". */
  now: z.object({ label: z.string().max(80) }),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export type ChatResponse = {
  reply: string;
  reminder?: Reminder | null;
  source: "deepseek" | "fallback";
};

export type UnderstandResponse = {
  understanding: Understanding;
  source: UnderstandingSource;
  /** Why the fallback was used, when it was. */
  note?: string;
};

export type TranscribeResponse =
  | { ok: true; text: string }
  | { ok: false; code: "NO_KEY" | "BAD_REQUEST" | "TOO_LARGE" | "UPSTREAM"; message: string };

/** `voice`: live AssemblyAI voice agent (natural TTS + streaming STT) is available. */
export type HealthResponse = { transcription: boolean; understanding: boolean; voice: boolean };

export type VoiceAgentSessionResponse =
  | { ok: true; session: Record<string, unknown>; token: string; systemPrompt: string }
  | { ok: false; code: "NO_KEY" | "RATE_LIMITED" | "UPSTREAM"; message: string };
