import { Folder, GitFork, SquareTerminal, type LucideIcon } from "lucide-react";
import type { AgentSession } from "../../domain/types";
import { tildify } from "../../domain/format";
import { subagentCounts } from "../../domain/session";
import styles from "./MetaRows.module.css";

interface Row {
  label: string;
  value: string;
  title?: string;
  Icon: LucideIcon;
}

function subagentText(session: AgentSession): string {
  const { total, running } = subagentCounts(session);
  return total === 0 ? "None" : `${total} · ${running} running`;
}

/** Directory, Terminal / PID and Subagents rows. */
export function MetaRows({ session }: { session: AgentSession }) {
  const rows: Row[] = [
    { label: "Directory", value: tildify(session.cwd), title: session.cwd, Icon: Folder },
    { label: "Terminal / PID", value: session.pid != null ? String(session.pid) : "—", Icon: SquareTerminal },
    { label: "Subagents", value: subagentText(session), Icon: GitFork },
  ];

  return (
    <dl className={styles.rows}>
      {rows.map(({ label, value, title, Icon }) => (
        <div key={label} className={styles.row}>
          <dt className={styles.label}>
            <Icon size={14} aria-hidden />
            {label}
          </dt>
          <dd className={styles.value} title={title}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
