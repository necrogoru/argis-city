import { highlight } from "../../domain/search";
import styles from "./CommandPalette.module.css";

/** `text` with the parts matching `query` emphasised. */
export function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlight(text, query).map((segment, i) =>
        segment.match ? (
          <mark key={i} className={styles.mark}>
            {segment.text}
          </mark>
        ) : (
          segment.text
        ),
      )}
    </>
  );
}
