<script setup lang="ts">
import { computed } from 'vue'
import MondrianArrow from '../components/MondrianArrow.vue'

const props = defineProps({
  image: { type: String, default: '' },
  class: { type: String, default: '' },
  backgroundSize: { type: String, default: 'contain' },
  imagePosition: { type: String, default: 'center' },
  backgroundColor: { type: String, default: '#090a0c' },
  imageOpacity: { type: [Number, String], default: 1 },
  imageScale: { type: [Number, String], default: 1 },
  imageTint: { type: String, default: '' },
  overlayImage: { type: String, default: '' },
  imagePaneColor: { type: String, default: 'transparent' },
  bleedImagePaneToBottom: { type: Boolean, default: false },
  arrowX: { type: [Number, String], default: '' },
  arrowY: { type: [Number, String], default: '' },
  arrowAngle: { type: [Number, String], default: 90 },
  arrowLength: { type: [Number, String], default: 75 },
  arrowColor: { type: String, default: '#2f6bff' },
  arrowWidth: { type: [Number, String], default: 7 },
  arrowHeadScale: { type: [Number, String], default: 0.5 },
})

const isTemplateImage = computed(() => props.image.endsWith('layout-placeholder.svg'))
const imageStyle = computed(() => props.image ? {
  backgroundImage: `url(${props.image})`,
  backgroundSize: props.backgroundSize,
  backgroundPosition: props.imagePosition,
  opacity: Number(props.imageOpacity),
  transform: `scale(${Number(props.imageScale)})`,
} : undefined)
const isWhiteTint = computed(() => props.imageTint === 'white')
</script>

<template>
  <div class="mondrian-image-bottom slidev-layout default" :class="{ 'mondrian-image-bottom--bleed-pane-to-bottom': props.bleedImagePaneToBottom }" :style="{ backgroundColor: props.backgroundColor }">
    <div class="mondrian-image-bottom__copy" :class="props.class">
      <slot />
    </div>
    <div class="mondrian-image-bottom__pane" :class="{ 'mondrian-image-bottom__pane--placeholder': isTemplateImage, 'mondrian-image-bottom__pane--overlay': props.overlayImage }" :style="{ backgroundColor: props.imagePaneColor }" aria-label="Image placeholder">
      <div v-if="image && !isTemplateImage" class="mondrian-image-bottom__art" :class="{ 'mondrian-image-bottom__art--white': isWhiteTint }" :style="imageStyle"></div>
      <img v-if="props.overlayImage" class="mondrian-image-bottom__overlay" :src="props.overlayImage" alt="" />
    </div>
    <MondrianArrow
      :x="props.arrowX"
      :y="props.arrowY"
      :angle="props.arrowAngle"
      :length="props.arrowLength"
      :color="props.arrowColor"
      :width="props.arrowWidth"
      :head-scale="props.arrowHeadScale"
    />
  </div>
</template>

<style scoped>
.mondrian-image-bottom { position: relative; display: grid; grid-template-rows: auto minmax(0, 1fr); width: 100%; height: 100%; box-sizing: border-box; padding: 2.3rem 2.6rem 2.1rem; background-position: 0 15%, 4% 0, 0 0; }
/* This is the public Image Bottom composition. Keep these coordinates here,
   rather than in the catalog slide, so every deck receives the same title,
   subtitle, and supporting-art anchor points. */
.mondrian-image-bottom__copy { display: grid; align-content: start; gap: .6rem; min-height: 0; padding: 0; transform: translate(4.5%, -1.3rem); }
.mondrian-image-bottom__copy :deep(h1), .mondrian-image-bottom__copy :deep(h2) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mondrian-image-bottom__copy :deep(h1) { margin: 0; line-height: 1.12; transform: translate(-20px, 20px); }
.mondrian-image-bottom__copy :deep(h2), .mondrian-image-bottom__copy :deep(p) { margin: 0; line-height: 1.2; opacity: .72; transform: translate(-15px, 2.6rem); }
.mondrian-image-bottom__pane { position: relative; min-height: 0; margin-top: 2rem; overflow: hidden; background: transparent; }
.mondrian-image-bottom--bleed-pane-to-bottom { padding-bottom: 0; }
.mondrian-image-bottom__pane--overlay { overflow: visible; }
.mondrian-image-bottom__art { position: absolute; inset: 0; background-position: center; background-repeat: no-repeat; }
.mondrian-image-bottom__art--white { filter: brightness(0) invert(1); }
.mondrian-image-bottom__overlay { position: absolute; z-index: 2; left: calc(50% - 20px); bottom: 0; width: min(25%, 20rem); max-height: 35%; object-fit: contain; transform: translateX(-50%); }
.mondrian-image-bottom__pane--placeholder { background: #55585c; }
</style>
