/** Lexically normalizes an absolute POSIX path without resolving symlinks. */
export function normalizeAbsolutePath(path: string): string | null {
  if (!path.startsWith("/")) return null;

  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  return `/${segments.join("/")}`;
}
