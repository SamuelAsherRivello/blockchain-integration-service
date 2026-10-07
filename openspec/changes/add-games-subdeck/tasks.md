# Tasks

## 1. Shared product composition

- [ ] 1.1 Add the theme-owned `mondrian-product` layout with a title, subtitle, and two equal 16:9 image-only panes; verify it renders at 16:9 without clipping or text over either image.
- [ ] 1.2 Add the `product-layout` example to `template-deck-b.md`, synchronize layout mappings, and verify the catalog exposes the new named layout.
- [ ] 1.3 Extend layout-contract coverage for the new declared layout and verify `npm run verify:layout-contract` passes.

## 2. Official game media and Games Subdeck

- [ ] 2.1 Select and document the official game page plus the highest-view official YouTube video for Bitmap.Game, SHRAPNEL, and Big Time; verify each source URL resolves and each recorded thumbnail is HD or has a documented fallback.
- [ ] 2.2 Capture an official 16:9 gameplay screenshot for each selected game under the Slidev assets directory and verify all image files render at the product layout's expected aspect ratio.
- [ ] 2.3 Create the Games Subdeck with one `mondrian-product` slide for each game, using the screenshot on the left and its official-video thumbnail on the right; verify all three slide labels, subtitles, and media load in the Slidev preview.
- [ ] 2.4 Register the Games Subdeck in the package scripts, live-preview manifest, and landing-page navigation following the Tease Subdeck convention; verify the shared approval preview exposes its route.

## 3. Safe official-site links

- [ ] 3.1 Add one FocusedLink per product slide that opens the official game page in a new tab; verify each link has its official URL and a clear game-specific accessible label.
- [ ] 3.2 Update the focused-link experience to retain a visible direct new-window destination when its framed official page cannot load; verify a framing-compatible URL and a deliberately framing-blocked URL both lead to a usable destination.
- [ ] 3.3 Test Bitmap.Game, SHRAPNEL, and Big Time official pages in the focused-link flow and set direct mode for any source that blocks framing; verify every slide reaches its official site in a new window.

## 4. Integrated visual verification

- [ ] 4.1 Run layout synchronization, `npm run verify:layout-contract`, and the relevant Slidev build; verify all commands succeed and update any generated mapping metadata.
- [ ] 4.2 Start or reuse the supervised Slidev preview, inspect the catalog and Games Subdeck routes at 16:9, and save rendered-review screenshots under `output/screenshots/add-games-subdeck/`; verify title/subtitle fit, matching panes, link affordances, and no overflow.
