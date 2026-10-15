/** Pure matching / ranking for the ⌘K command palette. */
import type { AgentSession, Project, Task } from "./types";
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

function matchStartScore(text: string, at: number): number {
  if (at === 0) return 3;
  return WORD_BOUNDARY.test(text[at - 1]) ? 2 : 1;
}

interface TokenMatch {
  score: number;
  start: number;
}

/** Exact matches retain their old scores; fuzzy alignments score by start, gaps, and span. */
function tokenMatch(token: string, text: string): TokenMatch | null {
  const haystack = text.toLowerCase();
  let bestScore = 0;
  let bestStart = -1;

  for (let at = 0; at < haystack.length; at++) {
    if (haystack[at] !== token[0] || haystack.length - at < token.length) continue;

    let score: number;
    if (haystack.startsWith(token, at)) {
      score = matchStartScore(haystack, at);
    } else {
      let cursor = at + 1;
      let last = at;
      let matched = true;
      for (let i = 1; i < token.length; i++) {
        const found = haystack.indexOf(token[i], cursor);
        if (found < 0) {
          matched = false;
          break;
        }
        last = found;
        cursor = found + 1;
      }
      if (!matched) continue;

      const isPrefix = at === 0;
      const isWordStart = !isPrefix && WORD_BOUNDARY.test(haystack[at - 1]);
      const base = isPrefix ? 0.9 : isWordStart ? 0.5 : 0.1;
      const gaps = last - at + 1 - token.length;
      score = Math.max(0.001, base - gaps * 0.01 - at * 0.001);
    }

    if (score > bestScore) {
      bestScore = score;
      bestStart = at;
    }
  }

  return bestStart >= 0 ? { score: bestScore, start: bestStart } : null;
}

/** 3 = prefix, 2 = start of a later word, 1 = substring, lower = subsequence. */
function tokenScore(token: string, text: string): number {
  return tokenMatch(token, text)?.score ?? 0;
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

export function scoreSession(session: AgentSession, tokens: readonly string[]): number | null {
  return scoreFields(tokens, sessionFields(session));
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
    .map((session) => ({ session, score: scoreSession(session, tokens) }))
    .filter((hit): hit is { session: AgentSession; score: number } => hit.score != null)
    .sort((a, b) => b.score - a.score || compareSessions(a.session, b.session))
    .map((hit) => hit.session);
}

function taskFields(task: Task, projectPath: string): SearchField[] {
  const fields: SearchField[] = [
    { text: task.title, weight: 4 },
    { text: `${task.id} #${task.id}`, weight: 3 },
    { text: task.description, weight: 2 },
    { text: projectPath, weight: 1 },
  ];
  if (task.worktreePath) fields.push({ text: "terminal agent shell", weight: 0.5 });
  return fields;
}

export function scoreTask(task: Task, projectPath: string, tokens: readonly string[]): number | null {
  return scoreFields(tokens, taskFields(task, projectPath));
}

/** Task search is opt-in: an empty query leaves the palette's default results uncluttered. */
export function searchTasks(tasks: readonly Task[], projects: readonly Project[], query: string): Task[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const projectPaths = new Map(projects.map((project) => [project.id, project.path]));
  return tasks
    .map((task, index) => ({
      task,
      index,
      score: scoreTask(task, projectPaths.get(task.projectId) ?? "", tokens),
    }))
    .filter((hit): hit is { task: Task; index: number; score: number } => hit.score !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((hit) => hit.task);
}

/** Empty query keeps the given order; otherwise matches by label, then keywords. */
export function searchActions<T extends Searchable>(actions: readonly T[], query: string): T[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [...actions];
  return actions
    .map((action, index) => ({ action, index, score: scoreAction(action, tokens) }))
    .filter((hit): hit is { action: T; index: number; score: number } => hit.score != null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((hit) => hit.action);
}

export function scoreAction(action: Searchable, tokens: readonly string[]): number | null {
  return scoreFields(tokens, [
    { text: action.label, weight: 2 },
    { text: (action.keywords ?? []).join(" "), weight: 1 },
  ]);
}

/** Split `text` into plain / matched runs for every query token (case-insensitive). */
export function highlight(text: string, query: string): Segment[] {
  const tokens = tokenize(query);
  const lower = text.toLowerCase();
  const marked = new Array<boolean>(text.length).fill(false);
  for (const token of tokens) {
    let found = false;
    for (let at = lower.indexOf(token); at >= 0; at = lower.indexOf(token, at + 1)) {
      marked.fill(true, at, at + token.length);
      found = true;
    }
    if (!found) {
      const match = tokenMatch(token, lower);
      if (!match) continue;

      let cursor = match.start;
      marked[cursor] = true;
      for (let i = 1; i < token.length; i++) {
        cursor = lower.indexOf(token[i], cursor + 1);
        if (cursor < 0) break;
        marked[cursor] = true;
      }
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
