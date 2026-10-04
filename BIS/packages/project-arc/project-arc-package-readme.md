# Project Arc: prompt-authored project stories

[Back to the main README](../../../README.md)

`@bis/project-arc` is a lightweight browser presentation prototype for turning a repository-backed story into a playable, 16:9 web experience. It deliberately does not use the familiar “deck” and “slide” vocabulary. A publishable story is an **Arc**; each sequenced visual moment is a **Scene**; the Markdown source is a **Score**; and the small React application that renders it is the **Stage**. This distinction matters because the output is meant to live as a GitHub-friendly site and a recording surface, not as a manually edited office file.

The current Arc introduces Blockchain Integration Service (BIS), its game-facing boundaries, and the Stealth & Steel consumer story in ten Scenes. It opens with a welcome, follows with a story map, covers seven project beats, and ends with a thank-you. Buttons, scene dots, and keyboard controls make the sequence comfortable to present: Left and Right move between Scenes, while Home and End jump to the beginning and close. The Present control uses the browser’s fullscreen API when it is available.

## Markdown Score and Stage

The authored source is [stories/bis-project.arc.md](stories/bis-project.arc.md). It has a compact frontmatter block for Arc-wide title, theme, and description. Each Scene begins with an HTML-comment directive such as `<!-- arc: layout=split; eyebrow=02 / JOURNEY; visual=journey -->`, followed by ordinary Markdown. Scenes are separated by `---`. The parser intentionally understands only that small contract: it extracts layout, eyebrow, and visual names, then passes the remaining body to the existing Markdown renderer with GitHub-flavored Markdown support.

That simplicity is the main development choice. A person or an AI prompt can revise a claim, reorder a Scene, choose a layout, or add a list without navigating a graphical presentation editor. The Markdown remains readable in code review. The Stage owns presentation behavior and responsive styling, so the Score does not need inline CSS or framework-specific component syntax. Current visuals reuse checked-in BIS diagrams or CSS compositions; a later Arc can add approved game art through the same named-visual approach.

The layout catalog is documented in [scene-templates.md](scene-templates.md). It includes `opening`, `index`, `signal`, `split`, `architecture`, `proof`, `showcase`, `timeline`, `closing`, and `quote`. The first prototype uses a common split-stage implementation for resilience, while CSS gives each scene a distinct narrative rhythm. Keeping layout names stable now makes it possible to add more specialized React renderers later without rewriting Scores.

## Scope and boundaries

Project Arc is not a replacement for Slidev, Marp, reveal.js, Google Slides, or PowerPoint. Those tools offer mature export, notes, editor, and animation features. This package instead tests a narrower premise: repository-aware AI can draft an honest project story, humans can curate it as Markdown, and Vite can publish it as a small static route. It currently has no GUI editor, speaker notes, PDF export, automatic fact extraction, external data access, or authoring API. Never present prototype Scenes as evidence of a live wallet transaction or a completed production integration; preserve the underlying project’s documented verification limits.

The package has no runtime relationship to BIS wallets, local storage, accounts, or game state. It only imports public documentation images as build-time assets. That isolation is intentional: telling a story about the integration must not mutate it. Its GitHub Pages route is `/blockchain-integration-service/arc/` in production and `/arc/` on the shared development server. Existing Admin and Marketplace release labels and cache-buster contract remain unchanged.

## Run and verify

Run `npm run dev` from the repository root and open the printed Project Arc route, normally `http://127.0.0.1:5174/arc/`. Edit the Score and refresh to see changes. Run `npm run typecheck` to check the Stage, `npm run build --workspace @bis/project-arc` to create its static output, and `npm run build` to build it with the repository packages. `npm run stage:pages` copies the built Arc to the Pages artifact; `npm run verify:pages` confirms its public-artifact route renders alongside Admin and Marketplace. Starting or staging the prototype does not publish a release.
