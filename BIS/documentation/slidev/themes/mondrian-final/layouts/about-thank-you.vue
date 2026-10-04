<script setup lang="ts">
import MondrianCover from '../../mondrian-cover.vue'
</script>

<template>
  <MondrianCover class="mondrian-thank-you about-expanded-copy">
    <template #overlay>
      <div class="mondrian-about-copy mondrian-thank-you__copy">
        <slot />
      </div>
    </template>
  </MondrianCover>
</template>

<style lang="postcss">
.mondrian-thank-you .mondrian-cover-portrait {
  display: none;
}

.mondrian-thank-you__copy {
  position: absolute;
  z-index: 2;
  top: 28.099%;
  left: 4.5rem;
}
</style>
