import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fallbackFromMessages } from "@/lib/conversation/fallback";
import { dashboardReply } from "@/lib/conversation/dashboard-reply";
import type { ChatMessage } from "@/lib/schema";
import { transcribeAudio } from "@/lib/server/assemblyai";
import { UNDERSTANDING_MODEL, understandWithDeepSeek } from "@/lib/server/openrouter";
import { POST as understandRoute } from "@/app/api/understand/route";
import { POST as transcribeRoute } from "@/app/api/transcribe/route";
import { GET as voiceAgentRoute } from "@/app/api/voice-agent/route";
import { POST as chatRoute } from "@/app/api/chat/route";
import { wantsDocument } from "@/lib/chat/protocol";
import { ensureOnboardingAgent } from "@/lib/server/voice-agent";

const messages: ChatMessage[] = [
  { id: "1", role: "persona", text: "what does a normal day look like for you, and what do you want help with?" },
  { id: "2", role: "user", text: "I'm Priya, I run a bakery and I'm drowning in invoices and emails." },
];

function completion(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}

const good = {
  userName: "Priya",
  summary: "you're running a bakery and want help getting invoices and your inbox under control.",
  primaryGoal: "Stay on top of invoices",
  secondaryGoals: ["Get on top of the inbox"],
  suggestedAgentNames: ["Crumb", "Ledger", "Sol"],
  suggestedReminders: [
    { title: "Send outstanding invoices", when: "Mondays · 9am" },
    { title: "Inbox sweep", when: "Daily · 4pm" },
    { title: "Order flour", when: "Thursdays · 7am" },
  ],
};

describe("OpenRouter / DeepSeek understanding", () => {
  beforeEach(() => vi.stubEnv("OPENROUTER_API_KEY", "test-key"));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("calls DeepSeek V4.1 Flash with JSON mode and returns validated data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion("```json\n" + JSON.stringify(good) + "\n```"));
    vi.stubGlobal("fetch", fetchMock);
    const result = await understandWithDeepSeek(messages, fallbackFromMessages(messages));
    expect(result).toEqual(good);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(init.body);
    expect(body.model).toBe(UNDERSTANDING_MODEL);
    expect(UNDERSTANDING_MODEL).toBe("deepseek/deepseek-v4.1-flash");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(init.headers.authorization).toBe("Bearer test-key");
  });

  it("drops celebrity / assistant names and pads to three", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completion(JSON.stringify({ ...good, suggestedAgentNames: ["Beyonce", "Jarvis", "Crumb"] }))));
    const result = await understandWithDeepSeek(messages, fallbackFromMessages(messages));
    expect(result.suggestedAgentNames).toHaveLength(3);
    expect(result.suggestedAgentNames[0]).toBe("Crumb");
    expect(result.suggestedAgentNames).not.toContain("Beyonce");
    expect(result.suggestedAgentNames).not.toContain("Jarvis");
  });

  it("route falls back to the deterministic understanding when the model returns junk", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completion("sorry, i can't do that")));
    const res = await understandRoute(new Request("http://x/api/understand", { method: "POST", body: JSON.stringify({ messages }) }));
    const body = await res.json();
    expect(body.source).toBe("fallback");
    expect(body.understanding.userName).toBe("Priya");
    expect(body.understanding.summary).toMatch(/running a bakery/);
  });

  it("route falls back when OpenRouter errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    const res = await understandRoute(new Request("http://x/api/understand", { method: "POST", body: JSON.stringify({ messages }) }));
    expect((await res.json()).source).toBe("fallback");
  });

  it("route uses DeepSeek output when valid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completion(JSON.stringify(good))));
    const res = await understandRoute(new Request("http://x/api/understand", { method: "POST", body: JSON.stringify({ messages }) }));
    const body = await res.json();
    expect(body.source).toBe("deepseek");
    expect(body.understanding.primaryGoal).toBe("Stay on top of invoices");
  });
});

describe("AssemblyAI transcription", () => {
  beforeEach(() => vi.stubEnv("ASSEMBLYAI_API_KEY", "aai-key"));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uploads, requests a transcript and polls until completed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ upload_url: "https://cdn/x" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "t1" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "processing" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "completed", text: " Hi, I'm Priya. " })));
    vi.stubGlobal("fetch", fetchMock);
    const text = await transcribeAudio(new ArrayBuffer(8), { pollMs: 1 });
    expect(text).toBe("Hi, I'm Priya.");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.assemblyai.com/v2/upload");
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe("aai-key");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).audio_url).toBe("https://cdn/x");
    expect(fetchMock.mock.calls[3][0]).toBe("https://api.assemblyai.com/v2/transcript/t1");
  });

  it("route maps upstream failures to a retryable 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x", { status: 500 })));
    const form = new FormData();
    form.append("audio", new Blob([new Uint8Array(16)], { type: "audio/webm" }), "a.webm");
    const res = await transcribeRoute(new Request("http://x/api/transcribe", { method: "POST", body: form }));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ ok: false, code: "UPSTREAM" });
  });
});

describe("AssemblyAI voice agent (server)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    (globalThis as unknown as { __personaAgents?: Map<string, string> }).__personaAgents?.clear();
  });

  it("returns a clean NO_KEY 503 without a key", async () => {
    vi.stubEnv("ASSEMBLYAI_API_KEY", "");
    const res = await voiceAgentRoute(new Request("http://x/api/voice-agent"));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, code: "NO_KEY" });
  });

  it("creates the onboarding agent once, then reuses it; mints a single-use token", async () => {
    vi.stubEnv("ASSEMBLYAI_API_KEY", "aai-key");
    const created: { name?: string; voice?: unknown; tools?: { name: string }[] }[] = [];
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/v1/agents") && (!init?.method || init.method === "GET")) {
        return new Response(JSON.stringify(created.map((c, i) => ({ id: `agent_${i}`, name: c.name }))));
      }
      if (u.endsWith("/v1/agents") && init?.method === "POST") {
        created.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ id: `agent_${created.length - 1}` }), { status: 201 });
      }
      if (u.includes("/v1/token")) {
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer aai-key");
        expect(u).toContain("expires_in_seconds=120");
        return new Response(JSON.stringify({ token: "tok_123" }));
      }
      throw new Error(`unexpected ${u}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await voiceAgentRoute(new Request("http://x/api/voice-agent"));
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, agentId: "agent_0", token: "tok_123" });
    expect(body.systemPrompt).toMatch(/You are Persona/);
    expect(JSON.stringify(body)).not.toContain("aai-key");
    expect(created).toHaveLength(1);
    expect(created[0].voice).toEqual({ voice_id: "alba" });
    expect(created[0].tools?.[0].name).toBe("finish_onboarding");

    // Cache cleared → found by name via list, not created again.
    (globalThis as unknown as { __personaAgents?: Map<string, string> }).__personaAgents?.clear();
    expect(await ensureOnboardingAgent()).toBe("agent_0");
    expect(created).toHaveLength(1);
  });

  it("maps upstream failures to 502 without leaking details", async () => {
    vi.stubEnv("ASSEMBLYAI_API_KEY", "aai-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    const res = await voiceAgentRoute(new Request("http://x/api/voice-agent"));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, code: "UPSTREAM", message: "Couldn't start the call." });
  });
});

describe("dashboard AI chat route", () => {
  const body = {
    messages: [{ id: "1", role: "user", text: "remind me to prep the v2 demo thursday morning" }],
    profile: {
      userName: "Samira",
      agentName: "Nudge",
      summary: "you're a product manager shipping v2.",
      primaryGoal: "Ship v2 launch by November",
      secondaryGoals: [],
      reminders: [],
      gmail: "connected",
    },
    now: { label: "Sunday 27 September 2026, 1:50 am" },
  };
  const call = (text = body.messages[0].text) =>
    chatRoute(new Request("http://x/api/chat", { method: "POST", body: JSON.stringify({ ...body, messages: [{ id: "1", role: "user", text }] }) }));
  /** Read the NDJSON event stream the route returns. */
  const events = async (res: Response) =>
    (await res.text())
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { t: string; [k: string]: unknown });
  /** A streamed OpenRouter response, split into arbitrary chunks (even mid-fence). */
  const sse = (chunks: string[]) =>
    new Response(
      new ReadableStream({
        start(c) {
          const enc = new TextEncoder();
          for (const content of chunks) c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`));
          c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 900, completion_tokens: 40, prompt_tokens_details: { cached_tokens: 832 } } })}\n\ndata: [DONE]\n\n`));
          c.close();
        },
      }),
      { status: 200 },
    );
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("streams text and turns a reminder block into a validated reminder", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(sse(["got it, thurs", "day 9am.\n``", '`reminder\n{"title":"Prep the v2 demo","when":"Thu · 9am"}\n```\n']));
    vi.stubGlobal("fetch", fetchMock);
    const ev = await events(await call());
    expect(ev.filter((e) => e.t === "delta").map((e) => e.v).join("").trim()).toBe("got it, thursday 9am.");
    expect(ev.find((e) => e.t === "reminder")?.reminder).toEqual({ title: "Prep the v2 demo", when: "Thu · 9am" });
    expect(ev.at(-1)).toEqual({ t: "done", source: "deepseek" });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.model).toBe("deepseek/deepseek-v4.1-flash");
    expect(sent.stream).toBe(true);
    expect(sent.provider.order[0]).toBe("deepseek");
    // Static instructions first (cacheable), profile second, time only on the newest message.
    expect(sent.messages[0].content).toMatch(/^You are a Persona/);
    expect(sent.messages[0].content).not.toMatch(/Samira/);
    expect(sent.messages[1].content).toMatch(/Your name is Nudge\. You work for Samira/);
    expect(sent.messages.at(-1).content).toMatch(/^\[their local time: Sunday/);
  });

  it("parses a chart block into a validated chart artifact", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const chart = { type: "bar", title: "Meetings", labels: ["Mon", "Tue"], series: [{ name: "h", values: [6, 5, 99] }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sse(["here you go.\n```chart\n", JSON.stringify(chart), "\n```\n"])));
    const ev = await events(await call("chart my meetings"));
    expect(ev.some((e) => e.t === "artifact-start" && e.kind === "chart")).toBe(true);
    const art = ev.find((e) => e.t === "artifact")?.artifact as { kind: string; chart: { series: { values: number[] }[] } };
    expect(art.kind).toBe("chart");
    expect(art.chart.series[0].values).toEqual([6, 5]); // trimmed to the labels
  });

  it("only creates a document when the user asked for a file", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const reply = () => sse(["sure.\n```document\n", '{"title":"Plan","format":"pdf"}\n---\n# Plan\n- ship v2\n', "```\n"]);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => reply()));
    const asked = await events(await call("make me a pdf of my plan"));
    const doc = asked.find((e) => e.t === "artifact")?.artifact as { kind: string; doc: { title: string; format: string; markdown: string } };
    expect(doc).toMatchObject({ kind: "doc", doc: { title: "Plan", format: "pdf" } });
    expect(doc.doc.markdown).toMatch(/^# Plan/);

    const notAsked = await events(await call("what's my plan?"));
    expect(notAsked.some((e) => e.t === "artifact")).toBe(false);
    expect(notAsked.filter((e) => e.t === "delta").map((e) => e.v).join("")).toMatch(/# Plan/);
  });

  it("falls back to local replies if DeepSeek fails, and without a key", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    const ev = await events(await call());
    expect(ev.at(-1)).toEqual({ t: "done", source: "fallback" });
    expect(ev.find((e) => e.t === "reminder")?.reminder).toEqual({ title: "Prep the v2 demo", when: "Thursday morning" });

    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect((await events(await call())).at(-1)).toEqual({ t: "done", source: "fallback" });
    const bad = await chatRoute(new Request("http://x/api/chat", { method: "POST", body: "{}" }));
    expect(bad.status).toBe(400);
  });
});

describe("document intent", () => {
  it("recognises explicit file requests only", () => {
    expect(wantsDocument("Create me a PDF for the presentation that is in my email")).toBe(true);
    expect(wantsDocument("export this as markdown")).toBe(true);
    expect(wantsDocument("write me a one-pager for the launch")).toBe(true);
    expect(wantsDocument("what's in my email?")).toBe(false);
    expect(wantsDocument("i need to file my taxes")).toBe(false);
    expect(wantsDocument("what should i focus on this week?")).toBe(false);
  });
});

describe("dashboard replies", () => {
  const ctx = { agent: "Nova", userName: "Maya", primaryGoal: "Stay consistent with content" };
  it("turns 'remind me to…' into a reminder", () => {
    const r = dashboardReply("remind me to call the manufacturer tomorrow at 10am", ctx);
    expect(r.reminder).toEqual({ title: "Call the manufacturer", when: "Tomorrow at 10am" });
  });
  it("keeps weekdays out of the reminder title", () => {
    expect(dashboardReply("remind me to send the hiring scorecard to Priya friday at 10am", ctx).reminder).toEqual({
      title: "Send the hiring scorecard to Priya",
      when: "Friday at 10am",
    });
  });
  it("defaults the time when none is given", () => {
    expect(dashboardReply("can you remind me to water the plants", ctx).reminder).toEqual({ title: "Water the plants", when: "Tomorrow · 9am" });
  });
  it("ties other messages back to their goals", () => {
    expect(dashboardReply("i need to answer some emails", ctx).reply).toMatch(/get on top of the inbox/);
  });
});
