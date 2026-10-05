# Tasks

## 1. Source manifest and assets

- [ ] 1.1 Fetch the Google content deck's live outline, revision ID, text, table data, and native-image inventory into a checked-in source manifest; verify it records exactly 51 contiguous source slides with unique object IDs.
- [ ] 1.2 Classify source slides 3, 4, 5, 7, 8, 9, 17, 18, 19, and 51 as `copy image`, acquire permitted local assets, and verify each asset renders with its matching source slide metadata.
- [ ] 1.3 Recreate the explanatory visuals for source slides 10, 11, 12, 30, 31, 32, and 33 as `reimagine image` Slidev-native content; verify each retains the source slide's explanatory role against a fresh Google thumbnail.
- [ ] 1.4 Research and replace every source-deck `Todo source` placeholder with evidence-backed presentation copy; verify cited Lightning, Liquid, Taproot, and Ark material supports the delivered claims.

## 2. Slidev content migration

- [ ] 2.1 Replace the partial `blockchain-for-game.md` outline with 51 slides ordered by the source manifest; verify every slide declares the matching `contentSlide` and `contentSlideId` exactly once.
- [ ] 2.2 Transfer the source titles, body copy, editable diagrams, and slide-42 layer comparison table without omitting source claims; verify the manifest coverage check passes, including every table cell.
- [ ] 2.3 Assign every migrated slide an existing cataloged Mondrian layout and extend the catalog only when a required source composition lacks one; verify `npm run verify:layout-contract` passes from `BIS/documentation/slidev`.
- [ ] 2.4 Keep the established Blockchain For Game base route and navigation behavior while updating the expanded deck; verify `/slidev/blockchain-for-game/1` opens the first source-corresponding slide and can navigate through slide 51.

## 3. Correspondence verification and review

- [ ] 3.1 Extend the Slidev verification scripts to compare the manifest against deck frontmatter, source order, image-treatment declarations, and the slide-42 table; verify the new check fails for a deliberately missing or duplicate mapping and passes for the completed deck.
- [ ] 3.2 Build and render the Blockchain For Game deck; verify `npm run build:blockchain-for-game`, `npm run verify:layout-contract`, and `npm run verify:rendered-layouts` pass from `BIS/documentation/slidev`.
- [ ] 3.3 Perform a browser review of all 51 local slides against fresh Google thumbnails, checking text fit, copied-image fidelity, reimagined-diagram meaning, and route availability; record the review outcome in the change evidence.
