<script setup lang="ts">
import BlankTemplate from './blank-template.vue'
</script>

<template><BlankTemplate class="video-template mondrian-video-xp"><slot /></BlankTemplate></template>

<style>
.slidev-layout.video-template { box-sizing: border-box; min-height: 100%; padding: 2rem 2.5rem 2.4rem; background: #0b0f1a; }
.slidev-layout.video-template > h1 { position: absolute; top: 4rem; right: auto; bottom: auto; left: 2.5rem; margin: 0 0 1.1rem; color: #fff; font-size: 2rem; line-height: 1; }
.slidev-layout.video-template > .xp-details { position: absolute; top: 5rem; right: 1.8%; bottom: auto; left: auto; margin: 0; text-align: right; }
.video-thumbnail-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); column-gap: .7rem; row-gap: 1.125rem; margin-top: calc(3.1rem + 50px); }
.video-thumbnail-grid a { display: block; overflow: hidden; border: 2px solid #283349; border-radius: .35rem; background: #151b2a; box-shadow: 0 .25rem .8rem rgb(0 0 0 / 35%); }
.video-thumbnail-grid img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
</style>
