# BIS Slidev documentation

This workspace contains two Slidev decks that share the local **Mondrian** theme. `modrian-template.md` opens the Modrian Template catalog: its examples document every public `mondrian-*` layout. `blockchain-for-game.md` is the Blockchain For Gaming content deck: each slide selects one of those same named layouts through frontmatter and supplies only its content and declared slots.

`themes/mondrian-final` is the source of truth for layouts, shared components, responsive styling, and interactive-image behavior. See its [layout catalog](./themes/mondrian-final/layout-catalog.json) and [theme guide](./themes/mondrian-final/README.md). The decks do not inherit Markdown from each other; this is Slidev's supported theme-and-layout model.

## Run the local approval preview

Use two PowerShell terminals from this folder:

```powershell
npm run dev:modrian-template
```

```powershell
npm run dev:blockchain-for-game
```

```powershell
npm run dev
```

Open `http://localhost:3032/`. The landing page links to the Modrian Template catalog and Blockchain For Gaming deck. The launcher on port 3032 proxies the catalog server on port 3049 and the content-deck server on port 3051, with no-cache headers for review.

## Layout contract and verification

Use `layout: mondrian-*` in a content deck and pair it with `templateLayout` and `catalogSlide`. The contract check fails when a Blockchain slide selects a non-Mondrian layout, maps to a different layout than it renders, maps to an example absent from the catalog, or declares another theme.

```powershell
npm run verify:layout-contract
npm run verify:layout-contract:self-test
npm run build:decks
npm run verify:rendered-layouts
```

`verify:rendered-layouts` requires the two Slidev servers above. It uses Playwright Chromium to compare all mapped Blockchain slides to their catalog layout and writes review screenshots under `output/screenshots/mondrian-slidev-refactor/`.

The reusable safe-area coordinates remain documented in `riverside-safe-area-guides.md`; the final theme deliberately contains no visible guide overlay. This workspace is independent from the repository’s shared Vite preview and GitHub Pages release unless that is added deliberately later.
