/**
 * ⚠️ DEMO MOCK — NOT A REAL GMAIL INTEGRATION.
 *
 * No OAuth flow runs, no Google permissions are requested, no network calls
 * are made, and no email data is read. This only simulates the timing of a
 * connection so the onboarding can show its connected state.
 *
 * A production version would redirect to Google OAuth with the narrowest
 * read-only scope, exchange the code server-side, and store the refresh token
 * encrypted — none of which happens here.
 */
export const GMAIL_MOCK = true as const;

export type MockGmailStage = "authorizing" | "syncing" | "connected";

export const MOCK_GMAIL_STAGES: { stage: MockGmailStage; label: string; ms: number }[] = [
  { stage: "authorizing", label: "opening a secure connection…", ms: 900 },
  { stage: "syncing", label: "looking for what's already in motion…", ms: 1100 },
];

/** Simulate a connection. Resolves after the staged delays; calls onStage for each step. */
export async function connectGmailMock(onStage: (stage: MockGmailStage, label: string) => void): Promise<void> {
  for (const { stage, label, ms } of MOCK_GMAIL_STAGES) {
    onStage(stage, label);
    await new Promise((r) => setTimeout(r, ms));
  }
  onStage("connected", "connected");
}
