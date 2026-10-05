import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Search } from "lucide-react";
import type { AgentSession } from "../../domain/types";
import { searchActions, searchSessions, tokenize, wrapIndex } from "../../domain/search";
import { useCameraRig } from "../../scene/useCameraRig";
import { useSelection } from "../../state/SelectionContext";
import { useSnapshot } from "../../state/SnapshotContext";
import { Kbd } from "../common/Kbd";
import { ActionOption, AgentOption } from "./PaletteOption";
import { useCommandActions, type CommandAction } from "./useCommandActions";
import styles from "./CommandPalette.module.css";

/** Agents listed before the user types anything (most urgent first). */
const IDLE_AGENT_LIMIT = 6;

type Option =
  | { key: string; kind: "agent"; session: AgentSession }
  | { key: string; kind: "action"; action: CommandAction };

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

/**
 * ⌘K modal: search live agents and run app actions. A native `<dialog>`
 * (top layer, focus trap, inert background); focus returns to where it was.
 */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    const el = dialog.current;
    if (!el || !open) return;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el.showModal();
    el.querySelector("input")?.focus();
    return () => {
      el.close();
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [open]);

  // Escape closes the palette only — preventDefault keeps the selection's Escape handler out of it.
  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    onClose();
  };

  return (
    <dialog
      ref={dialog}
      className={`glass ${styles.dialog}`}
      aria-label="Search agents and actions"
      onKeyDown={onKeyDown}
      // A stale `close` event (fired after a quick close → reopen) must not shut it again.
      onClose={(event) => !event.currentTarget.open && onClose()}
      onMouseDown={(event) => (pressedBackdrop.current = event.target === event.currentTarget)}
      onClick={(event) => {
        if (pressedBackdrop.current && event.target === event.currentTarget) onClose();
      }}
    >
      {open && <PaletteBody onClose={onClose} />}
    </dialog>
  );
}

/** Mounted only while open, so every opening starts with an empty query. */
function PaletteBody({ onClose }: { onClose: () => void }) {
  const { snapshot } = useSnapshot();
  const { selectSession } = useSelection();
  const rig = useCameraRig();
  const actions = useCommandActions();
  const [query, setQuery] = useState("");
  // Track the cursor by key so live snapshot reordering doesn't move it.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const listId = useId();
  const list = useRef<HTMLDivElement>(null);

  const sessions = useMemo(() => snapshot?.sessions ?? [], [snapshot]);
  const agents = useMemo(() => searchSessions(sessions, query, IDLE_AGENT_LIMIT), [sessions, query]);
  const matchedActions = useMemo(() => searchActions(actions, query), [actions, query]);
  const options = useMemo<Option[]>(
    () => [
      ...agents.map((session) => ({ key: `agent:${session.id}`, kind: "agent" as const, session })),
      ...matchedActions.map((action) => ({ key: `action:${action.id}`, kind: "action" as const, action })),
    ],
    [agents, matchedActions],
  );

  const found = options.findIndex((o) => o.key === activeKey);
  const activeIndex = found >= 0 ? found : options.length > 0 ? 0 : -1;
  const optionId = (index: number) => `${listId}-option-${index}`;

  const run = (option: Option) => {
    onClose();
    if (option.kind === "action") return option.action.run();
    selectSession(option.session.id);
    rig.focusSession(option.session.id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = wrapIndex(activeIndex, event.key === "ArrowDown" ? 1 : -1, options.length);
      setActiveKey(options[next]?.key ?? null);
      // Only keyboard moves scroll; hover and live updates leave the scroll position alone.
      document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      run(options[activeIndex]);
    }
  };

  const optionProps = (index: number) => ({
    domId: optionId(index),
    active: index === activeIndex,
    onHover: () => setActiveKey(options[index].key),
    onRun: () => run(options[index]),
    query,
  });

  const searching = tokenize(query).length > 0;
  const agentsAside = searching
    ? String(agents.length)
    : sessions.length > agents.length
      ? `${agents.length} of ${sessions.length} · type to search`
      : null;

  return (
    <>
      <div className={styles.search}>
        <Search size={18} className={styles.searchIcon} aria-hidden />
        <input
          className={styles.input}
          type="text"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-label="Search agents and actions"
          placeholder="Search agents or run an action…"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveKey(null);
            list.current?.scrollTo({ top: 0 });
          }}
          onKeyDown={onKeyDown}
        />
        <Kbd>esc</Kbd>
      </div>

      <div ref={list} id={listId} role="listbox" aria-label="Results" className={`thin-scroll ${styles.results}`}>
        {agents.length > 0 && (
          <Section title="Agents" aside={agentsAside}>
            {agents.map((session, i) => (
              <AgentOption key={session.id} session={session} {...optionProps(i)} />
            ))}
          </Section>
        )}
        {matchedActions.length > 0 && (
          <Section title="Actions">
            {matchedActions.map((action, i) => (
              <ActionOption key={action.id} action={action} {...optionProps(agents.length + i)} />
            ))}
          </Section>
        )}
        {options.length === 0 && <p className={styles.empty}>No agents or actions match “{query.trim()}”.</p>}
      </div>

      <footer className={styles.footer} aria-hidden>
        <span>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> navigate
        </span>
        <span>
          <Kbd>↵</Kbd> open
        </span>
        <span>
          <Kbd>esc</Kbd> close
        </span>
      </footer>
    </>
  );
}

function Section({ title, aside, children }: { title: string; aside?: string | null; children: ReactNode }) {
  const headingId = useId();
  return (
    <div role="group" aria-labelledby={headingId} className={styles.section}>
      <div className={styles.heading}>
        <span id={headingId} className="caps">
          {title}
        </span>
        {aside && <span className={styles.aside}>{aside}</span>}
      </div>
      {children}
    </div>
  );
}
