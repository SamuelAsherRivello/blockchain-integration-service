<script setup lang="ts">
const props = defineProps({
  class: { type: String, default: '' },
})
</script>

<template>
  <div class="slidev-layout two-cols-header mondrian-two-columns-header w-full h-full b-layout-slide-five b-safe-standard" :class="props.class">
    <div class="col-header"><slot /></div>
    <div class="col-left"><slot name="left" /></div>
    <div class="col-right"><slot name="right" /></div>
    <div class="col-bottom"><slot name="bottom" /></div>
  </div>
</template>

<style scoped>
.two-cols-header { display: grid; grid-template-columns: repeat(2, 1fr); grid-template-rows: auto 1fr auto; }
.col-header { grid-area: 1 / 1 / 2 / 3; }
.col-left { grid-area: 2 / 1 / 3 / 2; }
.col-right { grid-area: 2 / 2 / 3 / 3; }
.col-bottom { grid-area: 3 / 1 / 3 / 3; align-self: end; }
</style>
