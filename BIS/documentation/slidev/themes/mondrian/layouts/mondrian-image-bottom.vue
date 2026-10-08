<script setup lang="ts">
import ImageBottom from './image-bottom.vue'
defineProps({ image: { type: String, default: '' }, class: { type: String, default: '' }, backgroundSize: { type: String, default: 'contain' }, imagePosition: { type: String, default: 'center' }, backgroundColor: { type: String, default: '#090a0c' }, imageOpacity: { type: [Number, String], default: 1 }, imageScale: { type: [Number, String], default: 1 }, imageTint: { type: String, default: '' }, overlayImage: { type: String, default: '' }, imagePaneColor: { type: String, default: 'transparent' }, bleedImagePaneToBottom: { type: Boolean, default: false }, arrowX: { type: [Number, String], default: '' }, arrowY: { type: [Number, String], default: '' }, arrowAngle: { type: [Number, String], default: 90 }, arrowLength: { type: [Number, String], default: 75 }, arrowColor: { type: String, default: '#2f6bff' }, arrowWidth: { type: [Number, String], default: 7 }, arrowHeadScale: { type: [Number, String], default: 0.5 } })
</script>

<template><ImageBottom v-bind="$props" class="mondrian-image-bottom-layout"><slot /></ImageBottom></template>
