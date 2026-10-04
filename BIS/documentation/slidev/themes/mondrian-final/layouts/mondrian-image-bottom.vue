<script setup lang="ts">
import ImageBottom from './image-bottom.vue'
defineProps({ image: { type: String, default: '' }, class: { type: String, default: '' }, backgroundSize: { type: String, default: 'contain' } })
</script>

<template><ImageBottom v-bind="$props" class="mondrian-image-bottom-layout"><slot /></ImageBottom></template>
