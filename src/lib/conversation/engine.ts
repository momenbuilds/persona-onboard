/**
 * The onboarding call's dialogue manager.
 *
 * Deterministic and dependency-free on purpose: it runs in the browser on every
 * turn (no network round-trip, no API key needed) and is re-run on the server
 * to build the no-key fallback understanding. The LLM is only used afterwards,
 * to turn the finished transcript into structured JSON.
 *
 * Each turn: extract what we can (name, needs, project/role, routine),
 * acknowledge what was heard, then ask only for the most important thing
 * still missing — or wrap up.
 */
import { NEEDS, NEED_BY_ID, type NeedId } from "./needs";

export type Slots = {
  name?: string;
  needs: NeedId[];
  /** e.g. "building your fashion brand" */
  project?: string;
  /** e.g. "product designer" */
  role?: string;
  /** Short clauses about their day, e.g. "most days i'm up at 6". */
  routines: string[];
};

export type Topic = "opener" | "need" | "name" | "context";

export type EngineState = {
  slots: Slots;
  asked: { need: number; name: number; context: number };
  lastAsked: Topic;
  userTurns: number;
  done: boolean;
};

export type Heard = {
  name?: string;
  /** True when the name replaces a different one given earlier. */
  nameChanged?: boolean;
  needs: NeedId[];
  project?: string;
  role?: string;
  routine?: string;
};

export type Turn = { state: EngineState; reply: string; heard?: Heard };

export const WELCOME_LINE = "hey, i'm Persona. want to do a quick call so i can get to know you?";
export const OPENER = "what does a normal day look like for you, and what do you want help with?";
const MAX_USER_TURNS = 6;

export function initialEngine(): EngineState {
  return {
    slots: { needs: [], routines: [] },
    asked: { need: 0, name: 0, context: 0 },
    lastAsked: "opener",
    userTurns: 0,
    done: false,
  };
}

/* ------------------------------------------------------------------ */
/* Extraction                                                          */
/* ------------------------------------------------------------------ */

const NOT_A_NAME = new Set(
  (
    "a an the and but so or just really trying building working looking going launching starting running doing " +
    "here back good great fine okay ok not very pretty super also currently still always usually basically kind sort " +
    "based from in at on with up down out busy tired new happy sorry sure done ready persona hey hi hello yes yeah yep " +
    "no nope well um uh like gonna about into finally honestly literally mostly totally your my me mine everything " +
    "nothing something that this it what who why how when where there their they we us our you he she him her " +
    "student designer founder mom dad parent freelancer engineer developer writer creator teacher nurse doctor " +
    "monday tuesday wednesday thursday friday saturday sunday morning evening night today tomorrow weekend " +
    "january february march april may june july august september october november december " +
    "gonna wanna gotta kinda lol haha thanks thank please actually wait oops calling home work team " +
    "in-house self-employed always never usually around currently mostly"
  ).split(/\s+/),
);

function cleanName(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const word = raw.replace(/[^A-Za-z'-]/g, "").replace(/^['-]+|['-]+$/g, "");
  if (word.length < 2 || word.length > 20) return undefined;
  const lower = word.toLowerCase();
  if (NOT_A_NAME.has(lower)) return undefined;
  if (lower.length > 5 && lower.endsWith("ing")) return undefined;
  if (NEEDS.some((n) => n.match.test(lower))) return undefined;
  return lower[0].toUpperCase() + lower.slice(1);
}

function lastMatch(text: string, re: RegExp): string | undefined {
  let found: string | undefined;
  for (const m of text.matchAll(re)) {
    const name = cleanName(m[1]);
    if (name) found = name;
  }
  return found;
}

const CORRECTION_RES = [
  /\b(?:actually|sorry|wait|oops|no)[,.!]?\s+(?:it'?s|i'?m|im|i am|call me|my name(?:'s| is))\s+([a-z][a-z'-]+)/gi,
  /\bnot\s+[a-z'-]+[,.]?\s+(?:it'?s|i'?m)\s+([a-z][a-z'-]+)/gi,
  /\b(?:prefer|rather)\s+(?:to be called\s+|you call me\s+)([a-z][a-z'-]+)/gi,
];
const STRONG_NAME_RES = [
  /\bmy name(?:'s| is)\s+([a-z][a-z'-]+)/gi,
  /\bcall me\s+([a-z][a-z'-]+)/gi,
  /\bname'?s\s+([a-z][a-z'-]+)/gi,
];
/** Needs a capitalised name (transcripts capitalise names; "i'm tired" must not match). */
const WEAK_NAME_RE = /\b(?:[Ii]'?m|[Ii] am|[Tt]his is|[Ii]t'?s)\s+([A-Z][a-z'-]+)\b/g;

const FILLERS = /^(?:(?:oh|um+|uh+|so|yeah|yes|yep|sure|hey|hi|hello|ok|okay|well|haha|lol)[,.!]?\s+)+/i;

function extractName(text: string, lastAsked: Topic): { name?: string } {
  for (const re of CORRECTION_RES) {
    const name = lastMatch(text, re);
    if (name) return { name };
  }
  let name: string | undefined;
  for (const re of STRONG_NAME_RES) name = lastMatch(text, re) ?? name;
  name = name ?? lastMatch(text, WEAK_NAME_RE);
  if (name) return { name };

  // A short answer right after we asked for their name: "sam", "it's sam!", "Sam, thanks".
  if (lastAsked === "name") {
    const stripped = text
      .trim()
      .replace(FILLERS, "")
      .replace(/^(?:it'?s|i'?m|im|i am|just|call me|my name is)\s+/i, "");
    const words = stripped.split(/[\s,.!?]+/).filter(Boolean);
    if (words.length >= 1 && words.length <= 3) {
      const candidate = cleanName(words[0]);
      if (candidate) return { name: candidate };
    }
  }
  return {};
}

const HELP_CLAUSE_RE =
  /(?:help(?: me)?(?: with)?|need(?: help)?(?: with)?|want(?: help)?(?: with)?|struggl\w* (?:with|to)|wish i could|hard to|trying to|could use)\s+([^.!?]+)/gi;

function extractNeeds(text: string): NeedId[] {
  const helpText = [...text.matchAll(HELP_CLAUSE_RE)].map((m) => m[1]).join(" ");
  const explicit = NEEDS.filter((n) => helpText && n.match.test(helpText)).map((n) => n.id);
  const mentioned = NEEDS.filter((n) => n.match.test(text) && !explicit.includes(n.id)).map((n) => n.id);
  return [...explicit, ...mentioned];
}

const GERUND: Record<string, string> = {
  build: "building", launch: "launching", start: "starting", run: "running", grow: "growing",
  open: "opening", scale: "scaling", own: "running", manage: "managing",
};

function trimClause(s: string, maxWords: number): string {
  const cut = s.split(/\s+(?:and|but|so|while|which|that|where|because|who|with|then|plus)\b|[,;:]/i)[0];
  return cut.trim().split(/\s+/).slice(0, maxWords).join(" ");
}

function toYour(s: string) {
  return s.replace(/^(?:my|our)\s+/i, "your ");
}

const PROJECT_RES: RegExp[] = [
  /\b(?:i'?m|i am|im|we'?re|we are|currently|been)\s+(?:(?:trying to|about to|in the middle of|busy)\s+)?(build|building|launch|launching|start|starting|run|running|grow|growing|working on|opening|scaling)\s+((?:a|an|my|our|the)\s+[^,.;!?]{2,60}|[^,.;!?]{2,60})/i,
  /\bi\s+(run|own|manage)\s+((?:a|an|my|our)\s+[^,.;!?]{2,50})/i,
];
/** "i'm running late", "i'm starting to feel…" are not projects. */
const NOT_A_PROJECT =
  /^(?:to|late|behind|out|around|low|errands|on empty|a lot|lots|things|stuff|everything|myself|myself ragged|around all day)\b/i;
const PROJECT_NOUN_RE =
  /\bmy\s+((?:[a-z]+\s)?)(brand|business|startup|company|shop|store|podcast|channel|agency|studio|bakery|restaurant|app|label|line|practice)\b/i;
const PROJECT_NOUN_VERB: Record<string, string> = {
  brand: "building", startup: "building", company: "building", app: "building", label: "building", line: "launching",
  podcast: "growing", channel: "growing",
};

function extractProject(text: string): string | undefined {
  for (const re of PROJECT_RES) {
    const m = text.match(re);
    if (!m) continue;
    const verb = m[1].toLowerCase();
    const object = trimClause(m[2], 6);
    if (!object || /^(?:a|an|my|our|the)$/i.test(object) || NOT_A_PROJECT.test(object)) continue;
    const gerund = verb === "working on" ? "working on" : (GERUND[verb] ?? verb);
    return `${gerund} ${toYour(object)}`.toLowerCase();
  }
  const noun = text.match(PROJECT_NOUN_RE);
  if (noun) {
    const verb = PROJECT_NOUN_VERB[noun[2].toLowerCase()] ?? "running";
    return `${verb} your ${noun[1]}${noun[2]}`.toLowerCase();
  }
  return undefined;
}

const ROLE_RE =
  /\b(?:i'?m|i am|im|i work as)\s+(a|an)\s+([a-z][a-z -]{2,40}?)(?=\s*(?:[,.;!?]|\band\b|\bwho\b|\bat\b|\bin\b|\bbut\b|\bso\b|\bwith\b|\bfor\b|$))/i;
const NOT_A_ROLE = /^(?:bit|lot|little|big|huge|mess|kind|sort|total|complete|real|night owl|morning person|fan)\b/i;

function extractRole(text: string): string | undefined {
  const m = text.match(ROLE_RE);
  if (!m) return undefined;
  const role = m[2].trim().split(/\s+/).slice(0, 4).join(" ").toLowerCase();
  if (NOT_A_ROLE.test(role)) return undefined;
  return role;
}

const ROUTINE_RE =
  /\b(\d{1,2}(?::\d{2})?\s?(?:am|pm)|up at \d{1,2}|wake up|woke up|mornings?|evenings?|nights?|after work|before work|lunch|commute|9 ?(?:to|-) ?5|nine to five|shifts?|weekends?|every day|daily|most days|all day|weekdays?)\b/i;

function extractRoutine(text: string): string | undefined {
  const clause = text
    .split(/[.,;!?]|\s+and then\s+/i)
    .map((c) => c.trim())
    .find((c) => ROUTINE_RE.test(c));
  if (!clause) return undefined;
  return clause.split(/\s+/).slice(0, 10).join(" ").toLowerCase();
}

export function extract(text: string, ctx: { lastAsked?: Topic; currentName?: string } = {}): Heard {
  const { name } = extractName(text, ctx.lastAsked ?? "opener");
  const nameChanged = !!name && !!ctx.currentName && name.toLowerCase() !== ctx.currentName.toLowerCase();
  return {
    name,
    nameChanged: nameChanged || undefined,
    needs: extractNeeds(text),
    project: extractProject(text),
    role: extractRole(text),
    routine: extractRoutine(text),
  };
}

/* ------------------------------------------------------------------ */
/* Dialogue                                                            */
/* ------------------------------------------------------------------ */

export function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function article(word: string) {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

const SHRUGS = ["ha, fair enough.", "okay, noted.", "mm, i hear you."];

function wrapLine(state: EngineState) {
  const name = state.slots.name ? `, ${state.slots.name}` : "";
  return `perfect${name}. i've got what i need. give me a sec to put it together.`;
}

/** Pick the next question for whatever is still missing, or null when we can wrap up. */
function ask(state: EngineState): { state: EngineState; question: string | null; note?: string } {
  const s = structuredClone(state);
  const { slots, asked } = s;

  if (s.userTurns >= MAX_USER_TURNS) return { state: s, question: null };

  if (slots.needs.length === 0) {
    if (asked.need < 2) {
      asked.need += 1;
      s.lastAsked = "need";
      return {
        state: s,
        question:
          asked.need === 1
            ? "what's the one thing you'd love off your plate? inbox, content, calendar, anything."
            : "no pressure. is it more inbox, content, calendar, or just life admin?",
      };
    }
    // Don't trap anyone: start broad and learn as we go.
    slots.needs = ["lifeadmin"];
    return { ...ask(s), note: "no stress, i'll start with general life admin and learn as we go." };
  }

  if (!slots.name && asked.name < 2) {
    asked.name += 1;
    s.lastAsked = "name";
    return { state: s, question: asked.name === 1 ? "and what should i call you?" : "sorry, what's your name again?" };
  }

  const hasContext = !!(slots.project || slots.role || slots.routines.length);
  if (!hasContext && asked.context === 0) {
    asked.context = 1;
    s.lastAsked = "context";
    return { state: s, question: "last thing: when are you usually busiest, and what fills your day?" };
  }

  return { state: s, question: null };
}

/** Handle one user turn and produce Persona's reply. */
export function respond(prev: EngineState, text: string): Turn {
  const heard = extract(text, { lastAsked: prev.lastAsked, currentName: prev.slots.name });
  let state: EngineState = structuredClone(prev);
  state.userTurns += 1;
  const { slots } = state;

  const newNeeds = heard.needs.filter((n) => !slots.needs.includes(n));
  slots.needs.push(...newNeeds);

  const nameIsNew = !!heard.name && heard.name !== prev.slots.name;
  if (heard.name) slots.name = heard.name;

  const newProject = heard.project && heard.project !== slots.project ? heard.project : undefined;
  if (heard.project) slots.project = heard.project;
  const newRole = !newProject && heard.role && heard.role !== slots.role ? heard.role : undefined;
  if (heard.role) slots.role = heard.role;
  const newRoutine = heard.routine && !slots.routines.includes(heard.routine) ? heard.routine : undefined;
  if (newRoutine) slots.routines.push(newRoutine);

  const acks: string[] = [];
  if (nameIsNew) acks.push(heard.nameChanged ? `got it, ${slots.name} it is.` : `nice to meet you, ${slots.name}.`);
  if (newProject) acks.push(`${newProject}, love that.`);
  else if (newRole) acks.push(`${article(newRole)} ${newRole}, nice.`);
  if (newNeeds.length) acks.push(`so you want help ${joinList(newNeeds.slice(0, 2).map((n) => NEED_BY_ID[n].help))}.`);
  else if (newRoutine && !newProject && !newRole) acks.push("noted, i'll work around your routine.");

  const learned = nameIsNew || newProject || newRole || newNeeds.length > 0 || newRoutine;
  if (!learned) {
    if (prev.lastAsked === "context") acks.push("all good.");
    else if (text.trim().endsWith("?")) acks.push("good question, i can dig into that once we're set up.");
    else acks.push(SHRUGS[prev.userTurns % SHRUGS.length]);
  }

  const next = ask(state);
  state = next.state;
  if (next.note) acks.push(next.note);

  if (next.question) return { state, reply: [...acks, next.question].join(" "), heard };

  state.done = true;
  return { state, reply: [...acks, wrapLine(state)].join(" "), heard };
}

/** User tapped "that's everything" — wrap up with whatever we have. */
export function finishEarly(prev: EngineState): Turn {
  const state = { ...structuredClone(prev), done: true };
  if (state.slots.needs.length === 0) state.slots.needs = ["lifeadmin"];
  const name = state.slots.name ? `, ${state.slots.name}` : "";
  return { state, reply: `got it${name}. that's plenty to start with. give me a sec to put it together.` };
}

/** First line after reconnecting a call that was hung up. */
export function resumeTurn(prev: EngineState): Turn {
  const name = prev.slots.name ? `, ${prev.slots.name}` : "";
  if (prev.userTurns === 0) {
    return { state: { ...structuredClone(prev), lastAsked: "opener" }, reply: `welcome back${name}. no rush. ${OPENER}` };
  }
  const next = ask(prev);
  if (!next.question) {
    // Everything's covered (e.g. they came back to add something) — open the floor.
    return {
      state: { ...next.state, done: false, lastAsked: "context" },
      reply: `welcome back${name}. anything else i should know?`,
    };
  }
  return { state: next.state, reply: `welcome back${name}. picking up where we left off: ${next.question}` };
}

/** Replay a transcript through the engine (used server-side for the no-key fallback). */
export function slotsFromTranscript(userTurns: string[]): Slots {
  let state = initialEngine();
  for (const text of userTurns) state = respond(state, text).state;
  return state.slots;
}
