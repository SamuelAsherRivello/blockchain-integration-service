<script setup lang="ts">
import { computed } from 'vue'
import { useNav } from '@slidev/client'

const nav = useNav()
const frontmatter = computed(() => nav.currentFrontmatter.value)
</script>

<template>
  <div class="mondrian-dev-div">
    <strong>DEV DIV · DRAFT</strong><br>
    <a
      v-if="frontmatter.contentSlide && frontmatter.contentSlideId"
      :href="`https://docs.google.com/presentation/d/1Hte1KBBf7s2PoWWXTwKZbJ3jwUfaX7imqKuUa6gDg9E/edit?slide=id.${frontmatter.contentSlideId}#slide=id.${frontmatter.contentSlideId}`"
      target="_blank"
      rel="noopener"
    >Content - slide {{ frontmatter.contentSlide }}</a>
    <span v-else>Content - template-only</span><br>
    <a
      v-if="frontmatter.templateLayout && frontmatter.catalogSlide"
      :href="`/slidev/modrian-template/${frontmatter.catalogSlide}`"
      target="_blank"
      rel="noopener"
    >Layout - {{ frontmatter.templateLayout }} (catalog slide {{ frontmatter.catalogSlide }})</a>
    <span v-else>Style - template-only</span><br>
    <span>Draft slide {{ $nav.currentPage }}</span>
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
  padding: .55rem .7rem;
  border: 1px dashed rgba(255,255,255,.45);
  background: rgba(9, 13, 22, .86);
  color: rgba(255,255,255,.72);
  font-size: .62rem;
  line-height: 1.45;
  letter-spacing: .02em;
  pointer-events: auto;
}
.mondrian-dev-div strong { color: #f0c84b; font-size: .58rem; letter-spacing: .12em; }
.mondrian-dev-div a { color: #b7d6ff; text-decoration: underline; }
</style>
