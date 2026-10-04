# BIS Slidev documentation

This self-contained Slidev workspace hosts the finalized **Modrian Template**: a dark, 16:9 layout reference designed for recording. Its Markdown source is `template-deck-b.md`; `modrian-template.md` is the stable entry point; and `themes/mondrian-final` owns the selected presentation treatment.

## Run the final deck

Use two PowerShell terminals from this folder:

```powershell
npm run dev:modrian-template
```

```powershell
npm run dev
```

Open the clean launcher route at `http://localhost:3032/slidev/modrian-template/1`. The launcher on port 3032 proxies the final Slidev server on port 3049 and sends no-cache headers so updates appear immediately.

## Editing and verification

Edit `template-deck-b.md` for the slide content and `themes/mondrian-final` for the selected layouts and styling. The reusable safe-area coordinates remain documented in `riverside-safe-area-guides.md`; the final theme deliberately contains no visible guide overlay.

Run `npm run build` to build the final Modrian Template into the ignored `dist/` directory. This workspace is independent from the repository’s shared Vite preview and GitHub Pages release unless that is added deliberately later.
