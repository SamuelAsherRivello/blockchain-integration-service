<template>
  <div class="slidev-layout center mondrian-center h-full grid place-content-center">
    <div class="my-auto"><slot /></div>
  </div>
</template>

<style>
/* Keep the primary and supporting fields in one centered, left-aligned
   reading column. */
.slidev-layout.mondrian-center > div {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: fit-content;
  margin-inline: auto;
}

/* Treat the leading headline like selected text while retaining its natural
   text width. Supporting copy stays unhighlighted. */
.slidev-layout.mondrian-center > div > h1:first-child {
  display: inline-block;
  margin-inline: 0;
  padding: .04em .28em .09em;
  color: #fff;
  background: var(--mondrian-secondary, #1464e8);
}

/* A second headline keeps the normal heading scale and is inset slightly
   while preserving the centered text group. */
.slidev-layout.mondrian-center > div > h1:first-child + h1 {
  margin: .25em 0 0 .7em;
  line-height: 1.1;
}

/* Markdown `##` headings support the highlighted primary headline with a
   consistent 10px reading-column inset. */
.slidev-layout.mondrian-center > div > h2 {
  margin-left: 15px;
}
</style>
