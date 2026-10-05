<script setup lang="ts">
import ImageRight from './image-right.vue'
defineProps({ image: { type: String, default: '' }, class: { type: String, default: '' }, backgroundSize: { type: String, default: 'cover' } })
</script>

<template><ImageRight v-bind="$props" class="mondrian-image-right"><slot /></ImageRight></template>
