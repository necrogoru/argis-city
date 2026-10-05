/** Pure matching / ranking for the ⌘K command palette. */
import type { AgentSession } from "./types";
import { compareSessions } from "./agentList";
import { tildify } from "./format";
import { PROVIDERS } from "./providers";
import { statusMeta } from "./status";

export interface SearchField {
  text: string;
  /** Relative importance; a title outranks a directory. */
  weight: number;
}

/** Anything the palette can rank by label + extra words (actions). */
export interface Searchable {
  label: string;
  keywords?: readonly string[];
}

export interface Segment {
  text: string;
  match: boolean;
}

/** Lower-cased, whitespace-separated query terms. */
export function tokenize(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

const WORD_BOUNDARY = /[^\p{L}\p{N}]/u;

/** 3 = prefix, 2 = start of a later word, 1 = anywhere, 0 = absent. */
function tokenScore(token: string, text: string): number {
  const haystack = text.toLowerCase();
  let at = haystack.indexOf(token);
  if (at < 0) return 0;
  if (at === 0) return 3;
  while (at > 0) {
    if (WORD_BOUNDARY.test(haystack[at - 1])) return 2;
    at = haystack.indexOf(token, at + 1);
  }
  return 1;
}

/**
 * Every token must hit some field (AND); each contributes its best weighted
 * hit. Null when a token matches nothing.
 */
export function scoreFields(tokens: readonly string[], fields: readonly SearchField[]): number | null {
  let total = 0;
  for (const token of tokens) {
    let best = 0;
    for (const field of fields) best = Math.max(best, tokenScore(token, field.text) * field.weight);
    if (best === 0) return null;
    total += best;
  }
  return total;
}

/** Title first, then provider and status ("needs", "codex"), then the rest. */
export function sessionFields(session: AgentSession): SearchField[] {
  const status = statusMeta(session.status);
  return [
    { text: session.title, weight: 4 },
    { text: PROVIDERS[session.provider].label, weight: 2 },
    { text: `${status.label} ${status.chipLabel}`, weight: 2 },
    { text: session.model ?? "", weight: 1 },
    { text: tildify(session.cwd), weight: 1 },
    { text: session.currentStep ?? "", weight: 0.5 },
  ];
}

/**
 * Empty query: the `emptyLimit` most urgent sessions (list order). Otherwise
 * every match, best score first, ties in list order.
 */
export function searchSessions(
  sessions: readonly AgentSession[],
  query: string,
  emptyLimit = Infinity,
): AgentSession[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [...sessions].sort(compareSessions).slice(0, emptyLimit);
  return sessions
    .map((session) => ({ session, score: scoreFields(tokens, sessionFields(session)) }))
    .filter((hit): hit is { session: AgentSession; score: number } => hit.score != null)
    .sort((a, b) => b.score - a.score || compareSessions(a.session, b.session))
    .map((hit) => hit.session);
}

/** Empty query keeps the given order; otherwise matches by label, then keywords. */
export function searchActions<T extends Searchable>(actions: readonly T[], query: string): T[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [...actions];
  return actions
    .map((action, index) => {
      const fields = [{ text: action.label, weight: 2 }, { text: (action.keywords ?? []).join(" "), weight: 1 }];
      return { action, index, score: scoreFields(tokens, fields) };
    })
    .filter((hit): hit is { action: T; index: number; score: number } => hit.score != null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((hit) => hit.action);
}

/** Split `text` into plain / matched runs for every query token (case-insensitive). */
export function highlight(text: string, query: string): Segment[] {
  const tokens = tokenize(query);
  const lower = text.toLowerCase();
  const marked = new Array<boolean>(text.length).fill(false);
  for (const token of tokens) {
    for (let at = lower.indexOf(token); at >= 0; at = lower.indexOf(token, at + 1)) {
      marked.fill(true, at, at + token.length);
    }
  }
  const segments: Segment[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = segments[segments.length - 1];
    if (last && last.match === marked[i]) last.text += text[i];
    else segments.push({ text: text[i], match: marked[i] });
  }
  return segments;
}

/** Arrow-key movement through `length` options, wrapping at both ends. */
export function wrapIndex(index: number, delta: number, length: number): number {
  if (length <= 0) return -1;
  return (((index + delta) % length) + length) % length;
}
