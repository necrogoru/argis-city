import type { Task } from "./types";

interface TerminalTarget {
  taskId: number;
}

/** Normalize an absolute POSIX, drive-letter, or UNC path without filesystem access. */
export function normalizeAbsolutePath(path: string | null | undefined): string | null {
  if (!path) return null;

  const separated = path.replace(/\\/g, "/");

  if (/^[A-Za-z]:\//.test(separated)) {
    const segments = normalizeSegments(separated.slice(3).split("/"));
    return `${separated[0].toLowerCase()}:/` + segments.map((segment) => segment.toLowerCase()).join("/");
  }

  if (separated.startsWith("//")) {
    const rawSegments = separated.slice(2).split("/").filter(Boolean);
    const [server, share, ...rest] = rawSegments;
    if (!server || !share || server === "." || server === ".." || share === "." || share === "..") return null;
    const segments = normalizeSegments(rest).map((segment) => segment.toLowerCase());
    return `//${server.toLowerCase()}/${share.toLowerCase()}${segments.length ? `/${segments.join("/")}` : ""}`;
  }

  if (!separated.startsWith("/")) return null;

  const segments = normalizeSegments(separated.slice(1).split("/"));
  return segments.length ? `/${segments.join("/")}` : "/";
}

/** Find a matching task only among targets currently represented by the terminal rail. */
export function findTaskTerminalMatch(
  cwd: string,
  tasks: readonly Task[],
  terminalTargets: readonly TerminalTarget[],
): Task | null {
  const normalizedCwd = normalizeAbsolutePath(cwd);
  if (normalizedCwd == null) return null;

  const targetTaskIds = new Set(terminalTargets.map((target) => target.taskId));
  return tasks.find((task) =>
    targetTaskIds.has(task.id) && normalizeAbsolutePath(task.worktreePath) === normalizedCwd,
  ) ?? null;
}

function normalizeSegments(segments: string[]): string[] {
  const normalized: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      normalized.pop();
      continue;
    }
    normalized.push(segment);
  }

  return normalized;
}
