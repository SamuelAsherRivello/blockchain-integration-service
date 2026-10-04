# BIS Slidev documentation

This folder contains developer-facing Slidev presentations for the Blockchain Integration Service. The initial `slides.md` deck is a technical orientation drawn from the package-level Understand knowledge graph and the repository documentation. It deliberately distinguishes implemented package boundaries from experiments and documented limitations.

## Run the deck

From the repository root, enter this self-contained project and start the presentation:

```powershell
cd BIS/documentation/slidev
npm run dev
```

Open `http://localhost:3032`. Use `npm run build` to create a static SPA in this folder's ignored `dist/` directory.

## Editing

Edit `slides.md` to revise the draft. The deck uses the official `@slidev/theme-seriph` theme and standard Slidev Markdown. It has no independent application runtime and does not participate in the repository's shared Vite preview or GitHub Pages release unless that is added deliberately later.
