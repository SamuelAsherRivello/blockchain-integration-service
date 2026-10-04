<script setup lang="ts">
import MondrianCover from '../../mondrian-cover.vue'
import portraitImage from '../../../assets/mondrian-template-2-cover.png'
</script>

<template>
  <MondrianCover :image="portraitImage">
    <div class="mondrian-about-copy">
      <slot />
    </div>
  </MondrianCover>
</template>
