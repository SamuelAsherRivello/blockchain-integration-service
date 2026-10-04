<script setup lang="ts">
import { computed } from 'vue'
import { useNav } from '@slidev/client'

const nav = useNav()
const catalogLayout = computed(() => nav.currentFrontmatter.value.catalogLayout)
</script>

<template>
  <div v-if="catalogLayout" class="mondrian-catalog-label">Layout: {{ catalogLayout }}</div>
</template>

<style>
.mondrian-catalog-label { position: fixed; z-index: 9998; top: .8rem; left: .9rem; padding: .25rem .5rem; border: 1px solid rgb(255 255 255 / 28%); background: rgb(9 10 12 / 84%); color: #c8dbff; font: 600 .62rem/1.2 Arial, Helvetica, sans-serif; letter-spacing: .06em; }
</style>
