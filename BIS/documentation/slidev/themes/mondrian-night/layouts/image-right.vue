<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  image: { type: String, default: '' },
  class: { type: String, default: '' },
  backgroundSize: { type: String, default: 'cover' },
})

const isTemplateImage = computed(() => props.image.endsWith('layout-placeholder.svg'))
const isBImagePlaceholder = computed(() => isTemplateImage.value && props.class.includes('b-safe-image-right'))
const imageStyle = computed(() => props.image ? {
  backgroundImage: `url(${props.image})`,
  backgroundSize: props.backgroundSize,
} : undefined)
</script>

<template>
  <div class="mondrian-image-layout">
    <div class="slidev-layout default" :class="props.class">
      <slot />
    </div>
    <div class="mondrian-image-pane" :class="{ 'mondrian-image-pane--b-placeholder': isBImagePlaceholder }" :style="isTemplateImage ? undefined : imageStyle">
      <div v-if="isTemplateImage && !isBImagePlaceholder" class="mondrian-image-placeholder" aria-label="Image placeholder">
        <span>IMAGE</span>
        <small>REPLACE WITH VISUAL</small>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mondrian-image-layout { display: grid; grid-template-columns: 1fr 1fr; width: 100%; height: 100%; }
.mondrian-image-pane { display: grid; place-items: center; background: #111317; background-position: center; background-repeat: no-repeat; }
.mondrian-image-pane--b-placeholder { background: #55585c; }
.mondrian-image-placeholder { display: grid; place-content: center; width: 76%; aspect-ratio: 1; box-sizing: border-box; background: #34373c; border: 2px solid #50545a; color: #e7e1d6; text-align: center; box-shadow: inset -.85rem 0 0 #1464e8, inset 0 -.7rem 0 #f04a35; }
.mondrian-image-placeholder span { font: 900 2rem/1 Arial, Helvetica, sans-serif; letter-spacing: .12em; }
.mondrian-image-placeholder small { margin-top: .7rem; color: #c3c0ba; font: 700 .6rem/1 Arial, Helvetica, sans-serif; letter-spacing: .16em; }
</style>
