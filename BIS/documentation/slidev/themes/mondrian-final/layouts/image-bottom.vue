<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  image: { type: String, default: '' },
  class: { type: String, default: '' },
  backgroundSize: { type: String, default: 'contain' },
  backgroundColor: { type: String, default: '#090a0c' },
  imageOpacity: { type: [Number, String], default: 1 },
  imageScale: { type: [Number, String], default: 1 },
  imageTint: { type: String, default: '' },
})

const isTemplateImage = computed(() => props.image.endsWith('layout-placeholder.svg'))
const imageStyle = computed(() => props.image ? {
  backgroundImage: `url(${props.image})`,
  backgroundSize: props.backgroundSize,
  opacity: Number(props.imageOpacity),
  transform: `scale(${Number(props.imageScale)})`,
} : undefined)
const isWhiteTint = computed(() => props.imageTint === 'white')
</script>

<template>
  <div class="mondrian-image-bottom" :style="{ backgroundColor: props.backgroundColor }">
    <div class="mondrian-image-bottom__copy slidev-layout default" :class="props.class">
      <slot />
    </div>
    <div class="mondrian-image-bottom__pane" :class="{ 'mondrian-image-bottom__pane--placeholder': isTemplateImage }" :style="isTemplateImage ? undefined : { backgroundColor: props.backgroundColor }" aria-label="Image placeholder">
      <div v-if="image && !isTemplateImage" class="mondrian-image-bottom__art" :class="{ 'mondrian-image-bottom__art--white': isWhiteTint }" :style="imageStyle"></div>
    </div>
  </div>
</template>

<style scoped>
.mondrian-image-bottom { display: grid; grid-template-rows: auto minmax(0, 1fr); width: 100%; height: 100%; box-sizing: border-box; padding: 2.3rem 2.6rem 2.1rem; background: #090a0c; }
.mondrian-image-bottom__copy { min-height: 0; padding: 0; }
.mondrian-image-bottom__copy :deep(h1), .mondrian-image-bottom__copy :deep(h2) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mondrian-image-bottom__copy :deep(h1) { position: relative; top: 50px; margin: 0; line-height: 1; }
.mondrian-image-bottom__copy :deep(h2) { position: relative; top: 20px; margin: .5rem 0 0; line-height: 1; opacity: .72; }
.mondrian-image-bottom__pane { position: relative; min-height: 0; margin-top: 1rem; overflow: hidden; background: #171a1f; }
.mondrian-image-bottom__art { position: absolute; inset: 0; background-position: center; background-repeat: no-repeat; }
.mondrian-image-bottom__art--white { filter: brightness(0) invert(1); }
.mondrian-image-bottom__pane--placeholder { background: #55585c; }
</style>
