# Persona onboarding

A voice-first onboarding for [Persona](https://yourpersona.com). You meet your assistant in a two-minute call, it figures out who you are and what you need, you name it, and you land in a chat that already knows your week.

**Live demo:** https://persona-onboard.vercel.app · Next.js 16 · AssemblyAI · DeepSeek V4.1 Flash

---

## What's inside

**Landing page.** A clean rebuild of Persona's public site (hero, Persona Band, privacy, footer). The hero phone plays a live preview of the new onboarding, and every "Get Started" leads to it.

**`/start`, five screens**

| Screen | What happens |
| --- | --- |
| Welcome | *"hey, i'm Persona. want to do a quick call so i can get to know you?"* Call or type. |
| Call | Real-time voice with natural speech and turn-taking, or typing. Persona introduces itself, then asks one thing at a time: your name, what you need help with, your goals and your routine, reacting to what you say before moving on. It handles messy answers, name corrections, hang-ups and refreshes, and won't end the call until it has all four (unless you say you're done). |
| Your plan | A progress chart for *your* goal (income, growth, job search, routine, school, or busywork), with Persona vs. on your own over six months, plus the hours a week you get back, estimated from the call. Clearly labeled as an illustration. |
| Here's what I got | A one-line summary, your goals (pick the one that matters most), fresh name ideas generated from your answers every time, or a name of your own. |
| All set | A celebration: the orb shakes like a bottle and pops with a cork-and-fizz sound (synthesized with Web Audio, muted if you've muted Persona) and emoji confetti, then a personal "congrats" for your goal. |
| Gmail | **A mock connection.** No OAuth, no Google access. It builds a small demo inbox from your answers so the dashboard has something real-looking to work with. |
| Ready | Your agent says hello on screen and offers a few reminders to opt into. After the call, Persona stays silent. |

**Dashboard.** Chat with your agent. Replies stream in, and it can:

- draw **charts** (bar, line, area, pie, donut) with KPI tiles
- do **math** with rendered equations
- write **documents**, as a PDF or Markdown file with an inline preview, copy and download, *only when you ask for a file* (e.g. "make a PDF of the deck in my email")
- set **reminders** from plain language
- use your profile, goals and demo inbox, and say plainly what the preview can't do

## Product decisions

- **Voice first, typing one tap away.** Mic denied, no mic, or you'd rather not talk: the same conversation continues by text.
- **Ask only for what's missing.** No fixed questionnaire. Someone who says everything in one breath is done in one turn; a vague "work stuff" gets one concrete follow-up.
- **Never lose what the user said.** The mic starts inside the click so the first answer isn't swallowed while the device wakes up, a watchdog flags a silent mic (with a microphone picker), and the transcript survives hang-ups and refreshes.
- **Consent first.** Nothing is sent on the user's behalf; the assistant offers drafts. Gmail is clearly mocked.
- **Documents on request only.** Enforced on the server, not just in the prompt: without an explicit ask for a file, document content is shown as a normal reply.
- **It always works.** Every AI call has a deterministic fallback, so the whole flow runs with no API keys at all.

## How the AI works

```
browser mic ─ AudioWorklet (24 kHz PCM16) ─► Web Worker ─ WebSocket ─► AssemblyAI Voice Agent
                                                        ▲               (streaming STT, turn detection,
                  /api/voice-agent ─ single-use token ──┘                barge-in, natural voice)

/api/understand ─► OpenRouter · DeepSeek V4.1 Flash ─► summary, goals, names, reminders, time saved   (Zod-validated)
/api/chat       ─► DeepSeek, streamed as NDJSON     ─► text + chart / document / reminder blocks
/api/inbox, /api/names ─► DeepSeek                  ─► demo inbox, fresh agent names
/api/transcribe ─► AssemblyAI Universal-3.5 Pro     ─► fallback voice path (record → transcribe)
```

- **Voice** runs on the [AssemblyAI Voice Agent API](https://www.assemblyai.com/docs/voice-agents/voice-agent-api). The server creates the onboarding agent once (prompt, voice, a `finish_onboarding` tool) and mints a single-use token per call, so the API key never reaches the browser. Mic audio goes from an AudioWorklet straight to a worker that owns the socket, so a busy UI can't delay or drop speech. The running transcript is pushed into the agent's prompt after every turn, which keeps full context across typing, reconnects and "add something I missed".
- **Understanding and chat** use DeepSeek V4.1 Flash through OpenRouter. Structured outputs are validated with Zod. Chat streams text, and fenced `chart` / `document` / `reminder` blocks are parsed and validated on the server before they reach the UI.
- **Fallbacks**: with no key or a failed call, the app falls back to an on-device dialogue engine, deterministic understanding, a template inbox and rule-based chat replies.

## Cost and safety

- Keys are read only in server routes; nothing is `NEXT_PUBLIC_`. Voice uses single-use, two-minute browser tokens.
- **Prompt caching.** Chat sends a byte-identical instruction block first and the user's profile second, and routing is pinned to DeepSeek so its prefix cache hits. Cached input is billed at about 2% of the normal price.
- Rate limits on every paid route, a 90-second billing cap per recorded answer, a 4 MB upload limit, token budgets per request type, and trimmed chat history.
- Every request body is validated with Zod.

## Run it

```bash
pnpm install
cp .env.example .env.local   # optional: the app works without keys
pnpm dev                     # http://localhost:3000
```

| Variable | Used for | Without it |
| --- | --- | --- |
| `ASSEMBLYAI_API_KEY` | The voice call (Voice Agent API) and fallback transcription | Answers are typed and Persona uses the browser voice |
| `OPENROUTER_API_KEY` | DeepSeek V4.1 Flash: understanding, names, demo inbox, chat | Deterministic fallbacks |
| `PERSONA_VOICE` *(optional)* | Voice id, default `alba` (also `eve`, `jane`, `mary`, `anna`, `vera` and more) | — |

## Test it

```bash
pnpm check        # typecheck + lint + unit tests + production build
pnpm test:e2e     # Playwright on desktop and mobile, no keys (the fallback path)
node scripts/full-flow-check.mjs http://localhost:3000 out/              # whole product with real keys
node scripts/live-voice-check.mjs http://localhost:3000 answer.wav out/  # a spoken call through a fake mic
```

## Project map

```
src/app                    landing, /start, API routes
src/components/landing     hero, Band, privacy, footer
src/components/onboarding  the onboarding steps, dashboard, call controller
src/components/chat        streaming, markdown + KaTeX, charts, documents, preview panel
src/lib/conversation       on-device dialogue engine and fallbacks
src/lib/server             AssemblyAI, OpenRouter, voice agent, rate limiting
src/lib/voice              mic worklet client, playback, speech fallback
```

## License

Code: [MIT](LICENSE). The Persona name, logo and imagery in `public/brand` belong to Persona and are used here only for this take-home.
