import type { CSSProperties, ReactNode } from "react";
import type { AgentSession } from "../../domain/types";
import { tildify } from "../../domain/format";
import { cssVar } from "../../domain/palette";
import { PROVIDERS } from "../../domain/providers";
import { statusMeta } from "../../domain/status";
import { StatusPill } from "../common/StatusPill";
import { Swatch } from "../common/Swatch";
import { Highlight } from "./Highlight";
import type { CommandAction } from "./useCommandActions";
import styles from "./CommandPalette.module.css";

interface OptionShellProps {
  domId: string;
  active: boolean;
  onHover: () => void;
  onRun: () => void;
  style?: CSSProperties;
  children: ReactNode;
}

/** listbox option: hover moves the cursor, click runs it; focus stays in the input. */
function OptionShell({ domId, active, onHover, onRun, style, children }: OptionShellProps) {
  return (
    <div
      id={domId}
      role="option"
      aria-selected={active}
      className={styles.option}
      style={style}
      onPointerMove={active ? undefined : onHover}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onRun}
    >
      {children}
    </div>
  );
}

type OptionProps = Omit<OptionShellProps, "children" | "style"> & { query: string };

/** Status dot · title · `provider · model · ~/dir` · status pill. */
export function AgentOption({ session, query, ...shell }: OptionProps & { session: AgentSession }) {
  const tint = { "--tint": cssVar(statusMeta(session.status).color) } as CSSProperties;
  return (
    <OptionShell {...shell} style={tint}>
      <span className={styles.dot} data-status={session.status} aria-hidden />
      <span className={styles.main}>
        <span className={styles.label}>
          <Highlight text={session.title} query={query} />
        </span>
        <span className={styles.sub}>
          {PROVIDERS[session.provider].label} · {session.model ?? "unknown model"} · {tildify(session.cwd)}
        </span>
      </span>
      <StatusPill status={session.status} />
    </OptionShell>
  );
}

/** Icon tile (or provider swatch) · label · optional context hint. */
export function ActionOption({ action, query, ...shell }: OptionProps & { action: CommandAction }) {
  const { Icon, color, hint, label } = action;
  return (
    <OptionShell {...shell}>
      <span className={styles.tile}>{color ? <Swatch color={color} /> : <Icon size={16} aria-hidden />}</span>
      <span className={styles.main}>
        <span className={styles.label}>
          <Highlight text={label} query={query} />
        </span>
      </span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </OptionShell>
  );
}
