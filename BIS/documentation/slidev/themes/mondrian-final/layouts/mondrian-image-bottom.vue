<script setup lang="ts">
import ImageBottom from './image-bottom.vue'
defineProps({ image: { type: String, default: '' }, class: { type: String, default: '' }, backgroundSize: { type: String, default: 'contain' }, backgroundColor: { type: String, default: '#090a0c' }, imageOpacity: { type: [Number, String], default: 1 }, imageScale: { type: [Number, String], default: 1 }, imageTint: { type: String, default: '' } })
</script>

<template><ImageBottom v-bind="$props" class="mondrian-image-bottom-layout"><slot /></ImageBottom></template>
