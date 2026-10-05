<script setup lang="ts">
defineProps({
  class: { type: String, default: '' },
})
</script>

<template>
  <div class="slidev-layout section" :class="$props.class">
    <slot />
  </div>
</template>
