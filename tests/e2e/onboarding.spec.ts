import { expect, test, type Page } from "@playwright/test";

// Persona's speech is timed to the text; mute it so tests stay quick and silent.
async function openStart(page: Page) {
  await page.addInitScript(() => {
    // Make speech synthesis resolve instantly in CI browsers.
    if ("speechSynthesis" in window) {
      window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
        setTimeout(() => u.onend?.(new Event("end") as SpeechSynthesisEvent), 30);
      };
    }
  });
  await page.goto("/start");
}

const status = (page: Page) => page.getByTestId("call-status");
const answer = (page: Page) => page.getByLabel("Your answer");

test("hero CTA opens the new /start onboarding", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your personal intelligence" })).toBeVisible();
  await page.getByRole("link", { name: "Get Started" }).first().click();
  await expect(page).toHaveURL(/\/start$/);
  await expect(page.getByRole("heading", { name: /hey, i'm Persona/ })).toBeVisible();
});

test("happy path (typed): welcome → call → understanding → gmail → ready → dashboard", async ({ page }) => {
  await openStart(page);
  await page.getByRole("button", { name: "Type instead" }).click();

  await expect(page.getByText("what does a normal day look like for you, and what do you want help with?")).toBeVisible();
  await expect(status(page)).toHaveText("your turn");

  // Messy answer first: Persona acknowledges and re-asks instead of getting stuck.
  await answer(page).fill("ugh honestly idk, weird week lol");
  await answer(page).press("Enter");
  await expect(page.getByText(/ha, fair enough\. what's the one thing/)).toBeVisible();

  await answer(page).fill("i'm a freelance designer and i need help chasing invoices");
  await answer(page).press("Enter");
  await expect(page.getByText(/and what should i call you\?$/)).toBeVisible();

  await answer(page).fill("Jess");
  await answer(page).press("Enter");
  await expect(page.getByText(/perfect, Jess\./)).toBeVisible();
  await expect(status(page)).toHaveText("call complete");

  await page.getByRole("button", { name: /See what I got/ }).click();
  await expect(page.getByText("here's what i got")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("chasing invoices");
  await expect(page.getByLabel("i'll call you")).toHaveValue("Jess");
  await expect(page.getByText("understood on the built-in fallback (demo mode)")).toBeVisible();

  const continueBtn = page.getByRole("button", { name: /^Continue/ });
  await expect(continueBtn).toBeDisabled();
  // Celebrity names are refused.
  await page.getByLabel("Custom agent name").fill("Beyonce");
  await expect(page.getByText(/taken by someone famous/)).toBeVisible();
  await expect(continueBtn).toBeDisabled();
  await page.getByLabel("Custom agent name").fill("Penny");
  await expect(continueBtn).toBeEnabled();
  await continueBtn.click();

  await expect(page.getByText(/connect Gmail so Persona can understand/)).toBeVisible();
  await page.getByRole("button", { name: /Connect Gmail/ }).click();
  await expect(page.getByRole("heading", { name: "Gmail connected." })).toBeVisible();
  await page.getByRole("button", { name: /^Continue/ }).click();

  await expect(page.getByRole("heading", { name: "Penny is ready." })).toBeVisible();
  const reminders = page.getByRole("list").filter({ has: page.getByRole("button", { pressed: false }) });
  await reminders.getByRole("button").first().click();
  await expect(reminders.getByRole("button", { pressed: true })).toHaveCount(1);
  await page.getByRole("button", { name: /Open dashboard/ }).click();

  await expect(page.getByText("hey Jess! it's Penny. i'm all set up.")).toBeVisible();
  await expect(page.getByText(/i've added 1 reminder/)).toBeVisible();
  await page.getByLabel("Message Penny").fill("remind me to send the Acme invoice tomorrow at 9am");
  await page.getByLabel("Message Penny").press("Enter");
  await expect(page.getByText(/done\. i'll remind you to send the acme invoice/)).toBeVisible();
  await expect(page.getByText("Send the Acme invoice", { exact: true })).toBeVisible();
});

test("sample answer gives everything at once and finishes fast", async ({ page }) => {
  await openStart(page);
  await page.getByRole("button", { name: "Type instead" }).click();
  await page.getByRole("button", { name: "Use a sample answer" }).click();
  await expect(page.getByText(/nice to meet you, Maya\./)).toBeVisible();
  await expect(page.getByRole("button", { name: /See what I got/ })).toBeVisible();
});

test("name change mid-call is acknowledged", async ({ page }) => {
  await openStart(page);
  await page.getByRole("button", { name: "Type instead" }).click();
  await answer(page).fill("hey i'm Sam, i need help with my inbox, i'm a product manager");
  await answer(page).press("Enter");
  await expect(page.getByText(/nice to meet you, Sam\./)).toBeVisible();
  await expect(status(page)).toHaveText("call complete");
  // Re-open to correct the name.
  await page.getByRole("button", { name: /See what I got/ }).click();
  await page.getByRole("button", { name: "add something i missed" }).click();
  await expect(page.getByText("welcome back, Sam. anything else i should know?")).toBeVisible();
  await answer(page).fill("actually call me Samira");
  await answer(page).press("Enter");
  await expect(page.getByText(/got it, Samira it is\./)).toBeVisible();
  await page.getByRole("button", { name: /See what I got/ }).click();
  await expect(page.getByLabel("i'll call you")).toHaveValue("Samira");
});

test("hang up midway keeps the transcript and resumes gracefully (also across a refresh)", async ({ page }) => {
  await openStart(page);
  await page.getByRole("button", { name: "Type instead" }).click();
  await answer(page).fill("i need help staying on top of my calendar");
  await answer(page).press("Enter");
  await expect(page.getByText(/and what should i call you\?$/)).toBeVisible();

  await page.getByRole("button", { name: "Hang up" }).click();
  await expect(status(page)).toHaveText("call ended");
  await expect(page.getByText("call paused")).toBeVisible();
  await expect(page.getByText("i need help staying on top of my calendar")).toBeVisible();

  await page.reload();
  await expect(page.getByText("call paused")).toBeVisible();
  await expect(page.getByText("i need help staying on top of my calendar")).toBeVisible();

  await page.getByRole("button", { name: "Resume by typing" }).click();
  await expect(page.getByText(/welcome back\. picking up where we left off: /)).toBeVisible();
  await answer(page).fill("it's Dev");
  await answer(page).press("Enter");
  await expect(page.getByText(/nice to meet you, Dev\./)).toBeVisible();
});

test("resuming before saying anything doesn't stack 'welcome back' openers", async ({ page }) => {
  await openStart(page);
  await page.getByRole("button", { name: "Type instead" }).click();
  await expect(status(page)).toHaveText("your turn");
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Hang up" }).click();
    await page.getByRole("button", { name: "Resume by typing" }).click();
    await expect(status(page)).toHaveText("your turn");
  }
  const log = page.getByRole("log", { name: "Call transcript" });
  await expect(log.getByText("what does a normal day look like for you, and what do you want help with?")).toHaveCount(1);
  await expect(log.getByText(/welcome back/)).toHaveCount(0);
});

test("continue with what I've shared after hanging up", async ({ page }) => {
  await openStart(page);
  await page.getByRole("button", { name: "Type instead" }).click();
  await answer(page).fill("i need help with content");
  await answer(page).press("Enter");
  await page.getByRole("button", { name: "Hang up" }).click();
  await page.getByRole("button", { name: /Continue with what I've shared/ }).click();
  await expect(page.getByText("here's what i got")).toBeVisible();
  // No name was given: the name field is empty and required.
  await expect(page.getByLabel("i'll call you")).toHaveValue("");
  await expect(page.getByText("add your name to continue")).toBeVisible();
});

test.describe("voice call without an AssemblyAI key", () => {
  test.use({ permissions: ["microphone"] });

  test("switches smoothly to typing and keeps the call going", async ({ page }) => {
    await openStart(page);
    await page.getByRole("button", { name: "Start a quick call" }).click();
    await expect(page.getByText(/voice transcription isn't configured here/)).toBeVisible();
    await expect(page.getByText("what does a normal day look like for you, and what do you want help with?")).toBeVisible();
    await expect(answer(page)).toBeVisible();
  });
});

test.describe("microphone refused", () => {
  test("falls back to typing when the mic is denied", async ({ page }) => {
    // Pretend transcription is configured so the call really asks for the mic…
    await page.route("**/api/health", (r) => r.fulfill({ json: { transcription: true, understanding: false } }));
    // …and make the browser refuse it.
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
    });
    await openStart(page);
    await page.getByRole("button", { name: "Start a quick call" }).click();
    await expect(page.getByText("no mic access? no problem, let's type instead.")).toBeVisible();
    await expect(answer(page)).toBeVisible();
    await answer(page).fill("i'm Ana and i want help with my calendar");
    await answer(page).press("Enter");
    await expect(page.getByText(/nice to meet you, Ana\./)).toBeVisible();
  });
});

test.describe("APIs without keys", () => {
  test("health reports keys as missing, never the values", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(await res.json()).toEqual({ transcription: false, understanding: false, voice: false });
  });

  test("voice agent session returns a clean NO_KEY error", async ({ request }) => {
    const res = await request.get("/api/voice-agent");
    expect(res.status()).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, code: "NO_KEY" });
  });

  test("transcribe returns a clean NO_KEY error", async ({ request }) => {
    const res = await request.post("/api/transcribe", { multipart: { audio: { name: "a.webm", mimeType: "audio/webm", buffer: Buffer.from("x") } } });
    expect(res.status()).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, code: "NO_KEY" });
  });

  test("understand returns a validated deterministic fallback", async ({ request }) => {
    const res = await request.post("/api/understand", {
      data: {
        messages: [
          { id: "1", role: "persona", text: "what does a normal day look like for you, and what do you want help with?" },
          { id: "2", role: "user", text: "I'm Leo. I'm launching a coffee cart and need help with invoices" },
        ],
      },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.source).toBe("fallback");
    expect(body.understanding.userName).toBe("Leo");
    expect(body.understanding.suggestedAgentNames).toHaveLength(3);
    expect(body.understanding.suggestedReminders).toHaveLength(3);
  });

  test("understand rejects malformed input", async ({ request }) => {
    const res = await request.post("/api/understand", { data: { nope: true } });
    expect(res.status()).toBe(400);
  });
});
