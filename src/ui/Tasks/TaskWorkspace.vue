<script setup lang="ts">
import { onMounted } from "vue";
import { ArrowLeft } from "@lucide/vue";
import { useAppViewStore } from "../../stores/appView";
import { useTaskStore } from "../../stores/tasks";

const appView = useAppViewStore();
const taskStore = useTaskStore();

onMounted(() => {
  void taskStore.load();
});
</script>

<template>
  <main class="task-workspace">
    <header class="workspace-header">
      <div class="heading">
        <p class="eyebrow">ARGIS / TASKS</p>
        <h1>Projects & tasks</h1>
        <p class="description">Organize work by project, then open an isolated workspace when you’re ready.</p>
      </div>
      <button class="back-button" type="button" @click="appView.showCity()">
        <ArrowLeft :size="16" aria-hidden="true" />
        <span>Back to city</span>
      </button>
    </header>

    <section class="workspace-summary" aria-live="polite">
      <p v-if="taskStore.loading" class="summary-message" role="status">Loading projects and tasks…</p>
      <p v-else-if="taskStore.error" class="summary-message" role="alert">{{ taskStore.error }}</p>
      <p v-else class="summary-message">
        {{ taskStore.projects.length }} projects · {{ taskStore.tasks.length }} tasks
      </p>
    </section>
  </main>
</template>

<style scoped>
.task-workspace {
  box-sizing: border-box;
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 40px;
  padding: 40px;
  overflow: auto;
  background: var(--bg);
  color: var(--text);
}

.workspace-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding-top: 28px;
}

.heading {
  max-width: 700px;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--text-3);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 500;
  letter-spacing: -0.6px;
}

.description {
  margin: 10px 0 0;
  color: var(--text-2);
  font-size: 14px;
}

.back-button {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-button);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease;
}

.back-button:hover {
  border-color: var(--border-strong);
  background: var(--fill-hover);
}

.back-button:focus-visible {
  outline: 2px solid var(--teal);
  outline-offset: 2px;
}

.workspace-summary {
  min-height: 72px;
  padding: 20px 24px;
  border: 1px solid var(--border);
  border-radius: var(--radius-panel);
  background: var(--surface);
}

.summary-message {
  margin: 0;
  color: var(--text-2);
  font-size: 14px;
}

@media (max-width: 700px) {
  .task-workspace {
    gap: 24px;
    padding: 24px;
  }

  .workspace-header {
    flex-direction: column;
    align-items: stretch;
    padding-top: 8px;
  }

  .back-button {
    align-self: flex-start;
  }
}
</style>
