"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { initialEngine, type EngineState } from "@/lib/conversation/engine";
import type { Artifact } from "@/lib/chat/protocol";
import type { ChatMessage, InboxEmail, Reminder, Understanding, UnderstandingSource } from "@/lib/schema";

export type Step = "welcome" | "call" | "understanding" | "gmail" | "ready" | "dashboard";

/** The five onboarding screens (the dashboard is revealed after "ready"). */
export const STEPS: { id: Exclude<Step, "dashboard">; label: string }[] = [
  { id: "welcome", label: "Hello" },
  { id: "call", label: "Quick call" },
  { id: "understanding", label: "About you" },
  { id: "gmail", label: "Gmail" },
  { id: "ready", label: "Ready" },
];

export type ReminderChoice = Reminder & { added: boolean; fromChat?: boolean };

/** A dashboard chat message, optionally carrying charts/documents and a reminder it set. */
export type DashMessage = ChatMessage & { artifacts?: Artifact[]; reminderSet?: Reminder; failed?: boolean; at?: number };

export type OnboardingState = {
  v: 1;
  step: Step;
  callMode: "voice" | "text";
  messages: ChatMessage[];
  engine: EngineState;
  understanding: Understanding | null;
  source: UnderstandingSource | null;
  userName: string;
  agentName: string;
  gmail: "idle" | "connected" | "skipped";
  reminders: ReminderChoice[];
  chat: DashMessage[];
  /** DEMO inbox (Gmail is mocked): sample emails generated from the user's answers. */
  inbox: InboxEmail[];
  muted: boolean;
  /** Set when the user asked to (re)start the call; the call screen dials once and clears it. */
  dialPending: boolean;
  /** What the voice agent recorded in finish_onboarding (name, needs, goals, routine, details). */
  notes: Record<string, string>;
};

export type Action =
  | { type: "hydrate"; state: OnboardingState }
  | { type: "go"; step: Step }
  | { type: "startCall"; mode: "voice" | "text" }
  | { type: "setMode"; mode: "voice" | "text" }
  | { type: "addMessage"; message: ChatMessage }
  /** Add, or replace by id (live captions grow word by word). */
  | { type: "upsertMessage"; message: ChatMessage }
  | { type: "setEngine"; engine: EngineState }
  | { type: "setUnderstanding"; understanding: Understanding; source: UnderstandingSource }
  | { type: "setUserName"; name: string }
  | { type: "setAgentName"; name: string }
  | { type: "setGmail"; status: OnboardingState["gmail"] }
  | { type: "toggleReminder"; index: number }
  | { type: "addReminder"; reminder: Reminder }
  | { type: "addChat"; message: DashMessage }
  | { type: "setInbox"; inbox: InboxEmail[] }
  /** The user picked which goal matters most: it becomes the primary goal. */
  | { type: "setPrimaryGoal"; goal: string }
  | { type: "setSuggestedNames"; names: string[] }
  | { type: "setMuted"; muted: boolean }
  /** Back to the call to add something (keeps the transcript, re-runs understanding after). */
  | { type: "reopenCall" }
  | { type: "dialed" }
  /** Nothing was said yet: drop the stale opener(s) so a redial starts clean. */
  | { type: "clearTranscript" }
  | { type: "setNotes"; notes: Record<string, string> }
  | { type: "reset" };

export function initialState(): OnboardingState {
  return {
    v: 1,
    step: "welcome",
    callMode: "voice",
    messages: [],
    engine: initialEngine(),
    understanding: null,
    source: null,
    userName: "",
    agentName: "",
    gmail: "idle",
    reminders: [],
    chat: [],
    inbox: [],
    muted: false,
    dialPending: false,
    notes: {},
  };
}

export function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function reducer(state: OnboardingState, action: Action): OnboardingState {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "go":
      return { ...state, step: action.step };
    case "startCall":
      return { ...state, step: "call", callMode: action.mode, dialPending: true };
    case "dialed":
      return { ...state, dialPending: false };
    case "clearTranscript":
      return { ...state, messages: [], engine: initialEngine(), notes: {} };
    case "setNotes":
      return { ...state, notes: { ...state.notes, ...action.notes } };
    case "setMode":
      return { ...state, callMode: action.mode };
    case "addMessage":
      return { ...state, messages: [...state.messages, action.message] };
    case "upsertMessage": {
      const i = state.messages.findIndex((m) => m.id === action.message.id);
      if (i === -1) return { ...state, messages: [...state.messages, action.message] };
      const messages = state.messages.slice();
      messages[i] = action.message;
      return { ...state, messages };
    }
    case "setEngine":
      return { ...state, engine: action.engine };
    case "setUnderstanding":
      return {
        ...state,
        understanding: action.understanding,
        source: action.source,
        userName: action.understanding.userName || state.engine.slots.name || state.userName,
        agentName: "",
        reminders: action.understanding.suggestedReminders.map((r) => ({ ...r, added: false })),
      };
    case "setUserName":
      return { ...state, userName: action.name };
    case "setAgentName":
      return { ...state, agentName: action.name };
    case "setGmail":
      return { ...state, gmail: action.status };
    case "toggleReminder":
      return {
        ...state,
        reminders: state.reminders.map((r, i) => (i === action.index ? { ...r, added: !r.added } : r)),
      };
    case "addReminder":
      return { ...state, reminders: [...state.reminders, { ...action.reminder, added: true, fromChat: true }] };
    case "addChat":
      return { ...state, chat: [...state.chat, action.message] };
    case "setInbox":
      return { ...state, inbox: action.inbox };
    case "setPrimaryGoal": {
      const u = state.understanding;
      if (!u || u.primaryGoal === action.goal) return state;
      const all = [u.primaryGoal, ...u.secondaryGoals];
      return {
        ...state,
        understanding: { ...u, primaryGoal: action.goal, secondaryGoals: all.filter((g) => g !== action.goal) },
      };
    }
    case "setSuggestedNames":
      return state.understanding
        ? { ...state, understanding: { ...state.understanding, suggestedAgentNames: action.names } }
        : state;
    case "setMuted":
      return { ...state, muted: action.muted };
    case "reopenCall":
      return {
        ...state,
        step: "call",
        dialPending: true,
        understanding: null,
        source: null,
        agentName: "",
        engine: { ...state.engine, done: false },
      };
    case "reset":
      return { ...initialState(), muted: state.muted };
  }
}

const STORAGE_KEY = "persona-onboarding-v1";

function load(): OnboardingState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingState;
    if (parsed?.v !== 1 || !Array.isArray(parsed.messages) || !parsed.engine?.slots) return null;
    return { ...initialState(), ...parsed };
  } catch {
    return null;
  }
}

function save(state: OnboardingState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode / storage blocked: the flow still works, it just won't survive a refresh.
  }
}

/** Reducer + localStorage persistence, so a refresh or hang-up never loses the transcript. */
export function useOnboarding() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [hydrated, setHydrated] = useState(false);
  const didLoad = useRef(false);

  useEffect(() => {
    if (didLoad.current) return;
    didLoad.current = true;
    const saved = load();
    if (saved) dispatch({ type: "hydrate", state: saved });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) save(state);
  }, [state, hydrated]);

  return { state, dispatch, hydrated };
}
