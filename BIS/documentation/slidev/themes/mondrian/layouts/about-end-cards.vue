<script setup lang="ts">
import MondrianCover from '../../mondrian-cover.vue'
</script>

<template>
  <MondrianCover class="mondrian-about-end-cards">
    <div class="mondrian-about-copy">
      <slot />
    </div>
    <template #overlay>
      <div class="mondrian-about-end-cards__cards" aria-hidden="true">
        <div class="mondrian-about-end-cards__card" />
        <div class="mondrian-about-end-cards__card" />
      </div>
    </template>
  </MondrianCover>
</template>

<style lang="postcss">
.mondrian-about-end-cards .mondrian-cover-portrait {
  display: none;
}

.mondrian-about-end-cards__cards {
  position: absolute;
  z-index: 3;
  top: 11%;
  right: 6%;
  display: grid;
  gap: 5rem;
  width: 34%;
}

.mondrian-about-end-cards__card {
  aspect-ratio: 16 / 9;
  border: 2px solid rgb(255 255 255 / 32%);
  border-radius: .2rem;
  background: rgb(255 255 255 / 14%);
  box-shadow: 0 .35rem 1rem rgb(0 0 0 / 18%);
  opacity: .5;
}
</style>
