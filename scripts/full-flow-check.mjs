// End-to-end walkthrough of the whole product against a running server (uses whatever
// keys that server has). node scripts/full-flow-check.mjs <baseUrl> <outDir> [mobile]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [base = "http://localhost:3000", out = "full-flow", device] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const viewport = device === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 };

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("response", (r) => r.url().includes("/api/") && r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });

await page.goto(base);
await shot("0-landing");
await page.getByRole("link", { name: "Get Started" }).first().click();
await page.waitForURL("**/start");
await page.getByRole("button", { name: "Type instead" }).click();
await page.getByRole("button", { name: "Use a sample answer" }).waitFor({ timeout: 30000 });
await page.waitForFunction(() => document.querySelector('[data-testid="call-status"]')?.textContent === "your turn", null, { timeout: 30000 });
await page.getByRole("button", { name: "Use a sample answer" }).click();
await page.getByRole("button", { name: /See what I got|That's everything/ }).first().waitFor({ timeout: 60000 });
if (await page.getByRole("button", { name: "That's everything" }).isVisible().catch(() => false)) {
  await page.getByRole("button", { name: "That's everything" }).click();
}
await page.getByRole("button", { name: /See what I got/ }).waitFor({ timeout: 60000 });
log("call:", (await page.getByRole("log", { name: "Call transcript" }).innerText()).replace(/\n+/g, " | ").slice(0, 400));
await shot("1-call");
await page.getByRole("button", { name: /See what I got/ }).click();
await page.getByText("now, name your Persona").waitFor({ timeout: 40000 });
await page.waitForTimeout(2500);
log("summary:", await page.getByRole("heading", { level: 1 }).innerText());
log("names:", await page.getByRole("radiogroup", { name: "Agent name" }).getByRole("radio").allInnerTexts());
await shot("2-summary");
await page.getByRole("radiogroup", { name: "Agent name" }).getByRole("radio").first().click();
await page.getByRole("button", { name: /^Continue/ }).click();
// Time back: the hours-saved chart from the call.
await page.getByText("time back").waitFor({ timeout: 20000 });
await page.waitForTimeout(2200);
log("savings:", (await page.getByRole("heading", { level: 1 }).innerText()).replace(/\s+/g, " "), "|", (await page.getByRole("figure").innerText()).replace(/\n+/g, " | ").slice(0, 400));
await page.screenshot({ path: `${out}/savings.png` });
await page.getByRole("button", { name: /^Continue/ }).click();
await page.getByRole("button", { name: /Connect Gmail/ }).click();
await page.getByRole("heading", { name: "Gmail connected." }).waitFor({ timeout: 40000 });
await page.waitForTimeout(1200);
await shot("3-gmail");
await page.getByRole("button", { name: /^Continue/ }).click();
await page.getByRole("button", { name: /Open dashboard/ }).waitFor();
await page.waitForTimeout(1500);
await shot("4-ready");
await page.getByRole("button", { name: /Open dashboard/ }).click();
const composer = page.getByLabel(/^Message /).last();
await composer.waitFor({ timeout: 20000 });
await composer.fill("turn the deck in my email into a pdf");
await composer.press("Enter");
await page.getByRole("button", { name: "Stop" }).waitFor({ timeout: 10000 });
await page.getByRole("button", { name: "Stop" }).waitFor({ state: "detached", timeout: 90000 });
await page.waitForTimeout(1200);
log("dashboard doc cards:", await page.locator('button[aria-label^="Open "]:not([aria-label*="Next.js"])').count(), "| preview open:", await page.getByRole("dialog").count());
await shot("5-dashboard");
log("errors:", errors.length ? errors : "none");
await browser.close();
