# Tasks

## 1. Google-source manifest and visual assets

- [x] 1.1 Capture the live Google deck revision, 51 ordered source numbers, object IDs, text, tables, image treatments, and asset-resolution categories in a checked-in manifest; verify it reports 51 unique contiguous source numbers and includes slide 43 object ID `h5a9ba4b51e017a3d_3_0`.
- [x] 1.2 Acquire approved copied source images, upscale logo and table-cell assets 4× and larger chart or artwork assets 2×, and record their treatment in the manifest; verify each local asset meets its declared resolution category.
- [x] 1.3 Record `omit image` treatments for slides 10, 12, and 17–19, and `reimagine image` for the slide-11 game character visual; verify the manifest has no conflicting copied asset for those slides.
- [x] 1.4 Research and replace every Google source `Todo source` placeholder with evidence-backed Lightning, Liquid, Taproot, and Ark copy; verify each cited source supports the rendered claim.

## 2. Editable layouts, tables, and diagrams

- [x] 2.1 Add the cataloged `right-diagram` Mondrian layout with a text-bullet area on the left and Mermaid area on the right; verify the template deck renders a representative layout example and `npm run verify:layout-contract` passes from `BIS/documentation/slidev`.
- [x] 2.2 Build editable tables for slides 7–9: copied 4× visual body cells with editable title and headers for Web and Games, followed by the text-only Approach table; verify all source rows and columns render and titles and headers remain editable.
- [x] 2.3 Build editable four-by-three tables for slides 42 and 43; verify slide 42 conveys general Bitcoin layers and slide 43 uses the related game-oriented composition without a table-image dependency.
- [x] 2.4 Build custom game-loop diagrams for slides 10–12; verify slides 10 and 12 have no image assets and slide 11 includes the reimagined Pac-Man, pellets, and ghost visual.
- [x] 2.5 Build the shared Mermaid network for slides 31–33 and the BIS Mermaid map for slide 37; verify the network uses white lines on 31, gold lines on 32, and gold plus a red blocked line on 33.
- [x] 2.6 Convert slides 20–27 to the `right-diagram` layout with source-aligned left bullets and custom right-side Mermaid diagrams; verify all eight slides use the named layout and render their diagrams without overflow.

## 3. Deck conversion and correspondence checks

- [x] 3.1 Replace the partial Blockchain For Game Markdown deck with 51 manifest-backed slides in source order; verify every slide declares the matching `contentSlide` and `contentSlideId` exactly once.
- [x] 3.2 Transfer remaining source titles, claims, tables, and diagrams using cataloged Mondrian layouts; verify the correspondence check detects a deliberately missing, duplicate, or reordered source mapping.
- [x] 3.3 Extend verification to enforce source count, source identity, table-treatment rules, Mermaid treatments, image treatment, and declared 2×/4× copied-asset categories; verify the check passes against the completed deck.

## 4. Build and visual review

- [x] 4.1 Build and render the converted deck; verify `npm run build:blockchain-for-game`, `npm run verify:layout-contract`, and `npm run verify:rendered-layouts` pass from `BIS/documentation/slidev`.
- [x] 4.2 Compare all 51 local slides with fresh Google source thumbnails for content, table editability, image clarity, diagram meaning, and layout fit; record the review outcome in change evidence.
- [x] 4.3 Verify the established `/slidev/blockchain-for-game/` route opens slide 1 and supports navigation through slide 51 without console errors.

## Review evidence

- 2026-10-04: Google presentation revision `mLQv1AiQr6ustw` returned 51 contiguous 1600×900 source thumbnails, from object ID `p1` through `g3fb61a5d5fe_0_18`.
- The 51-slide local deck passed the structural correspondence check, production build, and rendered-layout verifier. The user-facing `localhost:3032/slidev/blockchain-for-game/` route loaded slides 1, 7, and 51 with no console errors; slide 7 confirmed all 18 copied visual cell assets loaded.
