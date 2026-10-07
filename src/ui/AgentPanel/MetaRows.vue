<script setup lang="ts">
import { computed } from "vue";
import { Folder, GitFork, SquareTerminal, type LucideIcon } from "@lucide/vue";
import type { AgentSession } from "../../domain/types";
import { tildify } from "../../domain/format";
import { subagentCounts } from "../../domain/session";

interface Row {
  label: string;
  value: string;
  title?: string;
  Icon: LucideIcon;
}

function subagentText(session: AgentSession): string {
  const { total, running, awaiting } = subagentCounts(session);
  if (total === 0) return "None";
  return [`${total}`, `${running} running`, awaiting > 0 ? `${awaiting} need${awaiting === 1 ? "s" : ""} you` : null]
    .filter(Boolean)
    .join(" · ");
}

const props = defineProps<{ session: AgentSession }>();
const rows = computed<Row[]>(() => [
  { label: "Directory", value: tildify(props.session.cwd), title: props.session.cwd, Icon: Folder },
  { label: "Terminal / PID", value: props.session.pid != null ? String(props.session.pid) : "—", Icon: SquareTerminal },
  { label: "Subagents", value: subagentText(props.session), Icon: GitFork },
]);
</script>

<!-- Directory, Terminal / PID and Subagents rows. -->
<template>
  <dl class="rows">
    <div v-for="row in rows" :key="row.label" class="row">
      <dt class="label"><component :is="row.Icon" :size="14" aria-hidden="true" />{{ row.label }}</dt>
      <dd class="value" :title="row.title">{{ row.value }}</dd>
    </div>
  </dl>
</template>

<style scoped>
.rows {
  margin: 0;
  display: flex;
  flex-direction: column;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 38px;
  border-top: 1px solid var(--border);
}

.row:last-child {
  border-bottom: 1px solid var(--border);
}

.label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--text-3);
  white-space: nowrap;
}

.value {
  margin: 0;
  min-width: 0;
  font-size: 13px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}
</style>
