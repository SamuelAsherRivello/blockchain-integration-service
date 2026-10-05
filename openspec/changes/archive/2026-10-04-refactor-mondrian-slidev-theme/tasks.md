# Tasks

## 1. Inventory and theme contract

- [x] 1.1 Inventory every composition in `template-deck-b.md` and every layout/style mapping in `blockchain-for-game.md`; record the stable layout name, supported slots/frontmatter, and catalog example for each, then verify the inventory covers every mapped content slide.
- [x] 1.2 Normalize `themes/mondrian-final` into a complete local Slidev theme manifest with documented named layouts and shared components; verify Slidev resolves every named layout from a minimal deck using the theme.
- [x] 1.3 Define a layout-aware audit convention for Blockchain slides that links the selected named layout to its catalog example; verify the convention rejects or reports a style reference that disagrees with its `layout` frontmatter.

## 2. Build the Mondrian layout catalog

- [x] 2.1 Move the reusable structure, responsive rules, animation, and interactive-image presentation for intro, section/subsection, ordinary content, two-column, and two-column-header compositions into named theme layouts; verify each layout renders with representative slot content.
- [x] 2.2 Move the reusable structure for diagram, image, logo, about, and end compositions into named theme layouts; verify catalog examples preserve intended visual behavior and keyboard-accessible image links.
- [x] 2.3 Update `template-deck-b.md` and its `modrian-template.md` entry point so each supported layout is visibly cataloged with its layout name; verify the template deck build succeeds and every named layout has an example.

## 3. Migrate the Blockchain For Game deck

- [x] 3.1 Replace generic or independently styled layout usage in `blockchain-for-game.md` with the corresponding named Mondrian theme layouts, preserving existing slide content and order; verify frontmatter selects only cataloged layouts.
- [x] 3.2 Convert per-slide content to the named slots/frontmatter accepted by its selected layout and remove duplicated structural CSS/markup from the deck; verify representative slides render their content without local layout overrides.
- [x] 3.3 Replace numeric-only `styleSlide` review labels with layout-aware audit references and verify every mapped Blockchain slide points to the matching catalog layout.

## 4. Verify the shared-layout contract

- [x] 4.1 Build the template catalog and Blockchain deck with the local Mondrian theme; verify both builds complete without layout-resolution errors.
- [x] 4.2 Verify every Blockchain For Gaming slide uses the custom Mondrian theme and a named layout cataloged by the Modrian Template deck; make any uncataloged layout or non-Mondrian theme declaration fail verification.
- [x] 4.3 Run browser comparisons for every mapped Blockchain slide against its Modrian Template catalog example; verify the same named layout and shared visual structure are present.
- [x] 4.4 Start the documentation preview and verify its landing page links to both the Modrian Template and Blockchain For Gaming routes, and that each route renders HTTP 200 for human approval.
- [x] 4.5 Update Slidev documentation to explain the theme, catalog-deck, content-deck relationship, definition-of-done gates, and verification commands; verify the documented commands and layout names match the implemented structure.
