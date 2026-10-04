<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  image: { type: String, default: '' },
  class: { type: String, default: '' },
  backgroundSize: { type: String, default: 'contain' },
})

const isTemplateImage = computed(() => props.image.endsWith('layout-placeholder.svg'))
const imageStyle = computed(() => props.image ? {
  backgroundImage: `url(${props.image})`,
  backgroundSize: props.backgroundSize,
} : undefined)
</script>

<template>
  <div class="mondrian-image-bottom">
    <div class="mondrian-image-bottom__copy slidev-layout default" :class="props.class">
      <slot />
    </div>
    <div class="mondrian-image-bottom__pane" :class="{ 'mondrian-image-bottom__pane--placeholder': isTemplateImage }" :style="isTemplateImage ? undefined : imageStyle" aria-label="Image placeholder"></div>
  </div>
</template>

<style scoped>
.mondrian-image-bottom { display: grid; grid-template-rows: auto minmax(0, 1fr); width: 100%; height: 100%; box-sizing: border-box; padding: 2.3rem 2.6rem 2.1rem; background: #090a0c; }
.mondrian-image-bottom__copy { min-height: 0; padding: 0; }
.mondrian-image-bottom__copy :deep(h1), .mondrian-image-bottom__copy :deep(h2) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mondrian-image-bottom__copy :deep(h1) { margin: 0; line-height: 1; }
.mondrian-image-bottom__copy :deep(h2) { margin: .5rem 0 0; line-height: 1; opacity: .72; }
.mondrian-image-bottom__pane { min-height: 0; margin-top: 1rem; background: #171a1f; background-position: center; background-repeat: no-repeat; }
.mondrian-image-bottom__pane--placeholder { background: #55585c; }
</style>
