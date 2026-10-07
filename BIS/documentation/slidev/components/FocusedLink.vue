<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  href: string
  name: string
  message: string
  tone?: 'yellow' | 'orange'
  mode?: 'frame' | 'direct'
}>(), {
  tone: 'yellow',
  mode: 'frame',
})

const destination = computed(() => {
  if (props.mode === 'direct') return props.href

  const search = new URLSearchParams({
    url: props.href,
    name: props.name,
    message: props.message,
  })

  return `./focused-link.html?${search}`
})
</script>

<template>
  <a
    :class="`deck-focus-${tone}-link`"
    :href="destination"
    target="_blank"
    rel="noopener noreferrer"
  ><slot /></a>
</template>
