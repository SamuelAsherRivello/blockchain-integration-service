<script setup lang="ts">
import MondrianCover from '../../mondrian-cover.vue'
import coverImage from '../../../assets/mondrian-template-2-cover.png'
</script>

<template>
  <MondrianCover :image="coverImage"><slot /></MondrianCover>
</template>
