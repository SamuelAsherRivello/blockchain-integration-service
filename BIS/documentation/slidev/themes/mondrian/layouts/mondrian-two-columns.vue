<script setup lang="ts">
const props = defineProps({
  class: { type: String, default: '' },
})
</script>

<template>
  <div class="slidev-layout two-columns mondrian-two-columns w-full h-full grid grid-cols-2 b-layout-slide-four b-safe-standard" :class="props.class">
    <div class="col-left"><slot /><slot name="left" /></div>
    <div class="col-right"><slot name="right" /></div>
  </div>
</template>
