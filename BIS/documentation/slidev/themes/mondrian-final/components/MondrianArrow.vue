<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  x: { type: [Number, String], required: true },
  y: { type: [Number, String], required: true },
  angle: { type: [Number, String], default: 90 },
  length: { type: [Number, String], default: 75 },
  color: { type: String, default: '#2f6bff' },
  width: { type: [Number, String], default: 7 },
  headScale: { type: [Number, String], default: 0.5 },
})

const geometry = computed(() => {
  const xInput = String(props.x).trim()
  const yInput = String(props.y).trim()

  if (!xInput || !yInput)
    return undefined

  const x = Number(xInput)
  const y = Number(yInput)
  const angle = Number(props.angle)
  const length = Number(props.length)
  const width = Number(props.width)
  const headScale = Number(props.headScale)
  const headLength = width * 10 * headScale
  const headHalfWidth = width * 3.5 * headScale

  if (![x, y, angle, length, width, headScale, headLength, headHalfWidth].every(Number.isFinite)
    || length <= 0 || width <= 0 || headScale <= 0 || headLength >= length)
    return undefined

  return {
    x,
    y,
    angle,
    length,
    headLength,
    headPoints: `${length},0 ${length - headLength},${headHalfWidth} ${length - headLength},${-headHalfWidth}`,
  }
})
</script>

<template>
  <svg v-if="geometry" class="mondrian-arrow" viewBox="0 0 1280 720" preserveAspectRatio="none" aria-hidden="true">
    <g :transform="`translate(${geometry.x} ${geometry.y}) rotate(${geometry.angle})`">
      <line x1="0" y1="0" :x2="geometry.length - geometry.headLength" y2="0" :stroke="color" :stroke-width="width" />
      <polygon :points="geometry.headPoints" :fill="color" />
    </g>
  </svg>
</template>

<style scoped>
.mondrian-arrow { position: absolute; inset: 0; z-index: 3; width: 100%; height: 100%; pointer-events: none; }
</style>
