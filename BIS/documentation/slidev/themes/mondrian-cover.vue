<script setup lang="ts">
import defaultCoverImage from '../assets/mondrian-cover-reference.png'

const { image = defaultCoverImage } = defineProps<{
  image?: string
}>()
</script>

<template>
  <div class="slidev-layout intro mondrian-cover">
    <div class="mondrian-cover-copy">
      <slot />
    </div>
    <div class="mondrian-cover-portrait" aria-hidden="true">
      <img :src="image" alt="" />
    </div>
    <slot name="overlay" />
  </div>
</template>

<style lang="postcss">
.mondrian-cover {
  grid-template-columns: minmax(0, 1fr) 38%;
  align-items: center;
  gap: 2rem;
}

.mondrian-cover-copy {
  z-index: 2;
}

.mondrian-cover-portrait {
  z-index: 2;
  aspect-ratio: 1;
  overflow: hidden;
  border: .45rem solid var(--mondrian-paper);
  border-radius: 50%;
  background: var(--mondrian-ink);
}

.mondrian-cover-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 75% 49%;
}

.mondrian-cover::after {
  top: auto;
  right: -6%;
  bottom: -25%;
  width: 19rem;
  height: 19rem;
}
</style>
