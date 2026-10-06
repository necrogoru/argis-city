<script setup lang="ts">
import { Check, CircleAlert, Hand, LoaderCircle, Moon, type LucideIcon } from "@lucide/vue";
import type { StatusIcon as StatusIconName } from "../../domain/status";

const ICONS: Readonly<Record<StatusIconName, LucideIcon>> = {
  loader: LoaderCircle,
  hand: Hand,
  moon: Moon,
  check: Check,
  alert: CircleAlert,
};

withDefaults(defineProps<{ icon: StatusIconName; size?: number }>(), { size: 12 });
</script>

<!-- Maps a domain status icon name onto its Lucide glyph. -->
<template>
  <component :is="ICONS[icon]" :size="size" :stroke-width="2.2" aria-hidden="true" />
</template>
