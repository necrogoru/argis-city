import { useRef } from "react";

/**
 * Last non-null value seen — lets a panel keep rendering its content while it
 * animates out after the underlying value has gone null.
 */
export function useRetained<T>(value: T | null): T | null {
  const last = useRef<T | null>(value);
  if (value != null) last.current = value;
  return value ?? last.current;
}
