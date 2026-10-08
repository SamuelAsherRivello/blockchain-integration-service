<script setup lang="ts">
const props = defineProps({
  class: { type: String, default: '' },
})
</script>

<template>
  <div class="slidev-layout mondrian-right-diagram" :class="props.class">
    <section class="mondrian-right-diagram__copy"><slot /><slot name="left" /></section>
    <section class="mondrian-right-diagram__visual" aria-label="Supporting diagram"><slot name="right" /></section>
  </div>
</template>

<style scoped>
.mondrian-right-diagram {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr);
  gap: 2.25rem;
  min-height: 100%;
  padding: 2.4rem 3rem 2.25rem;
  background: #090a0c;
}

.mondrian-right-diagram__copy { min-width: 0; align-self: center; }
.mondrian-right-diagram__copy :deep(h1) { margin: 0 0 .7rem; font-size: 2.25rem; line-height: 1.03; }
.mondrian-right-diagram__copy :deep(p) { margin: 0 0 .75rem; font-size: 1rem; line-height: 1.32; }
.mondrian-right-diagram__copy :deep(ul) { margin: .55rem 0 0; padding-left: 1.15rem; }
.mondrian-right-diagram__copy :deep(li) { margin: .25rem 0; font-size: .94rem; line-height: 1.25; }

.mondrian-right-diagram__visual {
  display: grid;
  place-items: center;
  min-width: 0;
  min-height: 0;
  padding: .55rem;
}
.mondrian-right-diagram__visual :deep(.mermaid) { width: 100%; max-width: 100%; }
.mondrian-right-diagram__visual :deep(svg) { max-width: 100%; max-height: 19rem; }
</style>
