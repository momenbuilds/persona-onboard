// Visual review helper: node scripts/screenshots.mjs [baseUrl] [outDir]
// Walks the landing page and the typed onboarding flow, saving screenshots.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "screenshots";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();

for (const [label, viewport] of [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[${label}] pageerror:`, e.message));
  page.on("console", (m) => m.type() === "error" && console.log(`[${label}] console.error:`, m.text()));

  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: `${out}/${label}-home-hero.png` });
  await page.screenshot({ path: `${out}/${label}-home-full.png`, fullPage: true });

  await page.getByRole("link", { name: "Get Started" }).first().click();
  await page.waitForURL("**/start");
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${out}/${label}-1-welcome.png` });

  await page.getByRole("button", { name: "Type instead" }).click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}/${label}-2-call.png` });

  await page.getByRole("button", { name: "Use a sample answer" }).click();
  await page.getByRole("button", { name: /See what I got/ }).waitFor({ timeout: 30000 });
  await page.screenshot({ path: `${out}/${label}-2b-call-done.png`, fullPage: true });

  await page.getByRole("button", { name: /See what I got/ }).click();
  await page.getByText("now, name your Persona").waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.getByRole("radio").first().click();
  await page.screenshot({ path: `${out}/${label}-3-understanding.png`, fullPage: true });

  await page.getByRole("button", { name: /Continue/ }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${label}-4-gmail.png` });
  await page.getByRole("button", { name: /Connect Gmail/ }).click();
  await page.getByText("Gmail connected.").waitFor({ timeout: 10000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${label}-4b-gmail-connected.png` });

  await page.getByRole("button", { name: /Continue/ }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Post today's content/ }).click();
  await page.screenshot({ path: `${out}/${label}-5-ready.png`, fullPage: true });

  await page.getByRole("button", { name: /Open dashboard/ }).click();
  await page.waitForTimeout(1500);
  await page.getByLabel(/^Message /).fill("remind me to call the manufacturer tomorrow at 10am");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${out}/${label}-6-dashboard.png`, fullPage: true });

  await ctx.close();
}

await browser.close();
console.log("done");
