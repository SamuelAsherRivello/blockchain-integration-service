<script setup lang="ts">
import { computed } from 'vue'
import { useNav } from '@slidev/client'

const DEV_LINK_VISIBLE = false

const nav = useNav()
const frontmatter = computed(() => nav.currentFrontmatter.value)
const isTemplate = computed(() => Boolean(frontmatter.value.catalogLayout))
const type = computed(() => isTemplate.value ? 'TEMPLATE' : 'DECK')
const layout = computed(() => isTemplate.value
  ? frontmatter.value.catalogLayout ?? frontmatter.value.layout
  : frontmatter.value.templateLayout ?? frontmatter.value.layout)
const layoutHref = computed(() => isTemplate.value
  ? `/slidev/modrian-template/${nav.currentPage.value}`
  : `/slidev/modrian-template/${frontmatter.value.catalogSlide}`)
</script>

<template>
  <div v-if="DEV_LINK_VISIBLE" class="mondrian-dev-div">
    <strong>TEMP: DEV DIV</strong><br>
    <span>TYPE: {{ type }}</span><br>
    <a
      v-if="layout"
      :href="layoutHref"
      target="_blank"
      rel="noopener"
    >LAYOUT: ({{ layout }})</a>
    <span v-else>LAYOUT: (unassigned)</span>
  </div>
</template>

<style>
.mondrian-dev-div {
  position: fixed !important;
  top: 0 !important;
  right: 0 !important;
  z-index: 9999 !important;
  width: 14rem;
  margin: 0 !important;
  padding: .25rem .7rem;
  border: 1px dashed rgba(255,255,255,.45);
  background: rgba(9, 13, 22, .86);
  color: rgba(255,255,255,.72);
  font-size: 6pt;
  line-height: 1.2;
  letter-spacing: .02em;
  pointer-events: auto;
}
.mondrian-dev-div strong { color: #f0c84b; font-size: 6pt; letter-spacing: .12em; }
.mondrian-dev-div a { color: #b7d6ff; text-decoration: underline; }
</style>
