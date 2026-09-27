import "server-only";

const BASE = "https://api.assemblyai.com/v2";

export class TranscriptionError extends Error {}

export function hasAssemblyKey() {
  return !!process.env.ASSEMBLYAI_API_KEY?.trim();
}

/**
 * Upload a short recording to AssemblyAI and poll until the transcript is ready.
 * AssemblyAI is used for transcription only.
 */
export async function transcribeAudio(
  audio: ArrayBuffer,
  { timeoutMs = 45_000, pollMs = 600 }: { timeoutMs?: number; pollMs?: number } = {},
): Promise<string> {
  const key = process.env.ASSEMBLYAI_API_KEY?.trim();
  if (!key) throw new TranscriptionError("ASSEMBLYAI_API_KEY is not set");
  const deadline = Date.now() + timeoutMs;

  const upload = await fetch(`${BASE}/upload`, {
    method: "POST",
    headers: { authorization: key, "content-type": "application/octet-stream" },
    body: audio,
    signal: AbortSignal.timeout(20_000),
  });
  if (!upload.ok) throw new TranscriptionError(`upload failed (${upload.status})`);
  const { upload_url } = (await upload.json()) as { upload_url?: string };
  if (!upload_url) throw new TranscriptionError("upload returned no url");

  const create = await fetch(`${BASE}/transcript`, {
    method: "POST",
    headers: { authorization: key, "content-type": "application/json" },
    // Universal-3.5 Pro: AssemblyAI's most accurate and fastest pre-recorded model.
    body: JSON.stringify({
      audio_url: upload_url,
      speech_models: ["universal-3-5-pro", "universal-2"],
      // Cost cap: never bill more than 90s per answer, whatever was uploaded.
      audio_end_at: 90_000,
      keyterms_prompt: ["Persona"],
      punctuate: true,
      format_text: true,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!create.ok) throw new TranscriptionError(`transcript request failed (${create.status})`);
  const { id } = (await create.json()) as { id?: string };
  if (!id) throw new TranscriptionError("transcript request returned no id");

  while (Date.now() < deadline) {
    const poll = await fetch(`${BASE}/transcript/${id}`, {
      headers: { authorization: key },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!poll.ok) throw new TranscriptionError(`polling failed (${poll.status})`);
    const body = (await poll.json()) as { status: string; text?: string | null; error?: string };
    if (body.status === "completed") return (body.text ?? "").trim();
    if (body.status === "error") throw new TranscriptionError(body.error ?? "transcription error");
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new TranscriptionError("transcription timed out");
}
