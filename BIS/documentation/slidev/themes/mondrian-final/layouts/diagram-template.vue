<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const container = ref<HTMLElement>()
let retryTimer: number | undefined

const shadows = {
  A: '#9d3830',
  B: '#1464e8',
  C: '#313842',
}

function applyNodeShadows() {
  const shadowRoot = container.value?.querySelector<HTMLElement>('.mermaid')?.shadowRoot
  if (!shadowRoot) return false

  let applied = 0
  for (const [node, color] of Object.entries(shadows)) {
    const rect = shadowRoot.querySelector<SVGRectElement>(`.node[id*="flowchart-${node}-"] rect.label-container`)
    if (rect) {
      rect.style.setProperty('filter', `drop-shadow(2px 2px 0 ${color})`, 'important')
      applied += 1
    }
  }
  return applied === Object.keys(shadows).length
}

onMounted(() => {
  let attempts = 0
  retryTimer = window.setInterval(() => {
    attempts += 1
    if (applyNodeShadows() || attempts === 30) {
      window.clearInterval(retryTimer)
      retryTimer = undefined
    }
  }, 50)
})

onBeforeUnmount(() => {
  if (retryTimer !== undefined) window.clearInterval(retryTimer)
})
</script>

<template>
  <div ref="container" class="slidev-layout mondrian-blank-template diagram-template">
    <slot />
  </div>
</template>
