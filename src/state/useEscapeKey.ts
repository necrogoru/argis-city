import { useEffect, useLayoutEffect, useRef } from "react";

/** Calls `handler` on Escape anywhere in the window (latest handler wins). */
export function useEscapeKey(handler: () => void): void {
  const latest = useRef(handler);
  useLayoutEffect(() => {
    latest.current = handler;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) latest.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
