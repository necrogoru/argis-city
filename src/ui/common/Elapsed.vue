<script setup lang="ts">
import { computed } from "vue";
import type { AgentStatus } from "../../domain/types";
import { formatElapsed } from "../../domain/format";
import { elapsedMs } from "../../domain/session";
import { useNow } from "../../composables/useNow";

const props = defineProps<{ item: { status: AgentStatus; startedAt: number; updatedAt: number } }>();
const now = useNow();
const text = computed(() => formatElapsed(elapsedMs(props.item, now.value)));
</script>

<!-- Self-ticking elapsed timer, isolated so only this text re-renders each second. -->
<template>{{ text }}</template>
