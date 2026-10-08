<script setup lang="ts">
const props = defineProps({
  class: { type: String, default: '' },
})
</script>

<template>
  <div class="slidev-layout default mondrian-content slide-three-offset b-safe-standard" :class="props.class">
    <slot />
  </div>
</template>
