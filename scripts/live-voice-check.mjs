// Live end-to-end check of the voice call with real keys (not part of CI).
// Chrome's fake microphone plays a WAV into the real /start call, so this
// exercises the AssemblyAI Voice Agent, live captions, finish_onboarding and
// the DeepSeek understanding step.
//
//   node scripts/live-voice-check.mjs http://localhost:3000 path/to/answer.wav out-dir
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [base = "http://localhost:3000", wav, out = "live-check"] = process.argv.slice(2);
if (!wav) throw new Error("pass a WAV file for the fake microphone");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${wav}%noloop`,
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, permissions: ["microphone"] });
const page = await ctx.newPage();
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
page.on("pageerror", (e) => log("pageerror", e.message));
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && log(`console.${m.type()}`, m.text()));
page.on("response", (r) => r.url().includes("/api/") && log("api", r.status(), new URL(r.url()).pathname));

await page.goto(`${base}/start`);
await page.getByRole("button", { name: "Start a quick call" }).click();

let lastStatus = "";
let lastBanner = null;
const deadline = Date.now() + Number(process.env.CALL_TIMEOUT_MS ?? 150_000);
let shot = 0;
while (Date.now() < deadline) {
  const status = (await page.getByTestId("call-status").textContent().catch(() => "")) ?? "";
  if (status !== lastStatus) {
    log("status →", status);
    lastStatus = status;
    await page.screenshot({ path: `${out}/call-${String(shot++).padStart(2, "0")}-${status.replace(/\W+/g, "-")}.png` });
  }
  const banner = await page.getByText(/can.t hear anything from your mic|microphone disconnected|paused Persona.s sound/).first().textContent({ timeout: 50 }).catch(() => null);
  if (banner && banner !== lastBanner) log("BANNER:", (lastBanner = banner));
  if (await page.getByRole("button", { name: /See what I got/ }).isVisible().catch(() => false)) break;
  await page.waitForTimeout(250);
}

const transcript = await page.getByRole("log", { name: "Call transcript" }).innerText().catch(() => "");
log("TRANSCRIPT:\n" + transcript);
await page.screenshot({ path: `${out}/call-final.png`, fullPage: true });

if (await page.getByRole("button", { name: /See what I got/ }).isVisible().catch(() => false)) {
  await page.getByRole("button", { name: /See what I got/ }).click();
  await page.getByText("now, name your Persona").waitFor({ timeout: 40_000 });
  await page.waitForTimeout(2500);
  log("SUMMARY:", await page.getByRole("heading", { level: 1 }).innerText());
  log("NAME FIELD:", await page.getByLabel("i'll call you").inputValue());
  log("AGENT NAMES:", (await page.getByRole("radio").allInnerTexts()).join(", "));
  log("SOURCE:", await page.getByText(/understood (with|on)/).innerText());
  await page.screenshot({ path: `${out}/understanding.png`, fullPage: true });
} else {
  log("call did not reach the wrap-up");
}
await browser.close();
