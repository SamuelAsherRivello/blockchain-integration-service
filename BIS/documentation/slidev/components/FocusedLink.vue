<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  href: string
  name: string
  message: string
  tone?: 'yellow' | 'orange'
}>(), {
  tone: 'yellow',
})

const destination = computed(() => {
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
