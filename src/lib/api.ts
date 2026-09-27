import { fallbackFromMessages } from "@/lib/conversation/fallback";
import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  HealthResponse,
  TranscribeResponse,
  UnderstandResponse,
  VoiceAgentSessionResponse,
} from "@/lib/schema";

export async function fetchHealth(): Promise<HealthResponse> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as HealthResponse;
  } catch {
    return { transcription: false, understanding: false, voice: false };
  }
}

export async function fetchVoiceSession(): Promise<VoiceAgentSessionResponse> {
  try {
    const res = await fetch("/api/voice-agent", { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const body = (await res.json().catch(() => null)) as VoiceAgentSessionResponse | null;
    return body ?? { ok: false, code: "UPSTREAM", message: `voice agent unavailable (${res.status})` };
  } catch {
    return { ok: false, code: "UPSTREAM", message: "couldn't reach the voice agent" };
  }
}

export async function transcribe(blob: Blob): Promise<TranscribeResponse> {
  const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
  const form = new FormData();
  form.append("audio", blob, `answer.${ext}`);
  try {
    const res = await fetch("/api/transcribe", { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
    const body = (await res.json().catch(() => null)) as TranscribeResponse | null;
    if (body && "ok" in body) return body;
    return { ok: false, code: "UPSTREAM", message: `Transcription failed (${res.status}).` };
  } catch {
    return { ok: false, code: "UPSTREAM", message: "Lost the connection while sending your answer." };
  }
}

/** Dashboard chat turn. Returns null if the request fails (caller falls back locally). */
export async function chat(req: ChatRequest): Promise<ChatResponse | null> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as ChatResponse;
  } catch {
    return null;
  }
}

/** Never throws: falls back to the on-device understanding if the request fails. */
export async function understand(messages: ChatMessage[], notes?: Record<string, string>): Promise<UnderstandResponse> {
  try {
    const res = await fetch("/api/understand", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages, notes }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as UnderstandResponse;
  } catch {
    return { understanding: fallbackFromMessages(messages), source: "fallback", note: "offline" };
  }
}
