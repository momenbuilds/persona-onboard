import { NextResponse } from "next/server";
import type { TranscribeResponse } from "@/lib/schema";
import { hasAssemblyKey, transcribeAudio } from "@/lib/server/assemblyai";
import { rateLimited } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Vercel caps request bodies at 4.5 MB; a 60s opus clip is well under that. */
const MAX_BYTES = 4 * 1024 * 1024;

function reply(body: TranscribeResponse, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!hasAssemblyKey()) {
    return reply(
      { ok: false, code: "NO_KEY", message: "Voice transcription isn't configured (ASSEMBLYAI_API_KEY)." },
      503,
    );
  }

  if (rateLimited(request, "transcribe", 30)) {
    return reply({ ok: false, code: "BAD_REQUEST", message: "Too many answers in a row. Try again in a few minutes." }, 429);
  }
  // Reject oversized bodies before reading them.
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES + 64_000) {
    return reply({ ok: false, code: "TOO_LARGE", message: "That clip is too long. Try a shorter answer." }, 413);
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const entry = form.get("audio");
    file = entry instanceof File ? entry : null;
  } catch {
    file = null;
  }
  if (!file || file.size === 0) {
    return reply({ ok: false, code: "BAD_REQUEST", message: "No audio received." }, 400);
  }
  if (file.type && !/^(audio|video)\//.test(file.type)) {
    return reply({ ok: false, code: "BAD_REQUEST", message: "That doesn't look like audio." }, 400);
  }
  if (file.size > MAX_BYTES) {
    return reply({ ok: false, code: "TOO_LARGE", message: "That clip is too long. Try a shorter answer." }, 413);
  }

  try {
    const text = await transcribeAudio(await file.arrayBuffer());
    return reply({ ok: true, text });
  } catch (error) {
    console.error("[transcribe]", error instanceof Error ? error.message : error);
    return reply({ ok: false, code: "UPSTREAM", message: "Couldn't transcribe that one." }, 502);
  }
}
