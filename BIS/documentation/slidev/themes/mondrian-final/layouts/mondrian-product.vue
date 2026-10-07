<script setup lang="ts">
const props = defineProps({ class: { type: String, default: '' } })
</script>

<template>
  <div class="slidev-layout mondrian-product" :class="props.class">
    <div class="mondrian-product__heading"><slot /></div>
    <div class="mondrian-product__columns">
      <section class="mondrian-product__column">
        <div class="mondrian-product__label"><slot name="left-label" /></div>
        <slot name="left" />
      </section>
      <section class="mondrian-product__column">
        <div class="mondrian-product__label"><slot name="right-label" /></div>
        <slot name="right" />
      </section>
    </div>
  </div>
</template>

<style scoped>
.mondrian-product { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 1.4rem; width: 100%; height: 100%; padding: 2.4rem 3.2rem 2.6rem; background: #0b0f1a; color: #fff; }
.mondrian-product__heading :deep(h1) { margin: 0; font-size: 3.2rem; line-height: 1; }
.mondrian-product__heading :deep(h2) { margin: .45rem 0 0; color: #bfc9dc; font-size: 1.35rem; font-weight: 500; line-height: 1.25; }
.mondrian-product__columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; min-height: 0; }
.mondrian-product__column { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: .55rem; min-width: 0; }
.mondrian-product__label { min-height: 1.6rem; font-size: 1.1rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.mondrian-product__column :deep(a > img) { display: block; width: 100%; height: 100%; min-height: 0; aspect-ratio: 16 / 9; object-fit: cover; border: 2px solid #283349; border-radius: .35rem; box-shadow: 0 .25rem .8rem rgb(0 0 0 / 35%); }
</style>
