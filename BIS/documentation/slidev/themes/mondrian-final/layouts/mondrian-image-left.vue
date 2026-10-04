<script setup lang="ts">
import ImageLeft from './image-left.vue'
defineProps({ image: { type: String, default: '' }, class: { type: String, default: '' }, backgroundSize: { type: String, default: 'cover' } })
</script>

<template><ImageLeft v-bind="$props" class="mondrian-image-left"><slot /></ImageLeft></template>
