# Riverside safe-area guides

The temporary Riverside review guides are intentionally absent from the final
Modrian Template deck. They remain documented here for a future recording or
layout-validation pass.

## Coordinates

| Guide | Insets from the slide edges | Treatment |
| --- | --- | --- |
| Primary / standard Riverside safe area | top 10%, right 22%, bottom 10%, left 10% | solid `#74ff4b` border with a faint green fill |
| Secondary / extreme right-speaker crop | top 13%, right 36%, bottom 13%, left 14% | dashed `#b6ff9e` border with a slightly stronger pale-green fill |

The primary frame is the normal placement target for essential readable text.
The secondary frame represents the restrictive right-speaker crop observed in
Riverside and is a recording check, not the general composition boundary.

## Restore temporarily

1. Add a `global-top.vue` file to the active theme directory. Global top
   layers render above every Slidev slide.
2. Add two absolutely positioned, `pointer-events: none` rectangles using the
   inset values above. Give the primary frame a solid bright-green border and
   the secondary frame a dashed pale-green border; label both frames.
3. Keep the overlay out of the final theme, or remove `global-top.vue`, before
   recording or publishing the deck.

The previous validation implementation remains in
`themes/mondrian-night/global-top.vue` as a reference. The selected final deck
uses `themes/mondrian`, which deliberately has no global overlay.
