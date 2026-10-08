<script setup lang="ts">
import DiagramTemplate from './diagram-template.vue'
const props = defineProps<{ class?: string }>()
</script>

<template><DiagramTemplate :class="['mondrian-diagram', props.class]"><slot /></DiagramTemplate></template>

<style>
.slidev-layout.diagram-template { box-sizing: border-box; min-height: 100%; display: flex; flex-direction: column; align-items: center; padding: 2.5rem; }
.slidev-layout.diagram-template > h1, .slidev-layout.diagram-template > h2 { width: 100%; text-align: center; }
.slidev-layout.diagram-template > h1 { margin: 0; }
.slidev-layout.diagram-template > h2 { margin: 1.75rem 0 0; opacity: .72; }
.diagram-template__canvas { display: flex; flex: 1; align-items: center; justify-content: center; width: 100%; }
.diagram-template__canvas .mermaid { max-width: 100%; }
</style>
