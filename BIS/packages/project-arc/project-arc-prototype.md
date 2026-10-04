# Project Arc prototype

Project Arc is a prompt-authored, browser-playable project story. It borrows the useful constraints of a presentation—fixed 16:9 composition, a sequence, and an audience-focused pace—without calling the work a deck or its units slides.

## Vocabulary

- **Arc:** one publishable project story, for example the BIS introduction at `/arc/`.
- **Scene:** one sequenced, 16:9 moment in an Arc. Scenes replace slides.
- **Score:** the Markdown source for an Arc. It holds content and declarative layout choices.
- **Stage:** the React renderer that turns a Score into the browser experience.
- **Theme:** the visual token set shared by a whole Arc.
- **Visual:** an optional asset or CSS composition selected by a Scene.

The initial Arc is deliberately a single Score plus a small Stage. An AI can inspect a repository, suggest an Arc outline, draft a Score, and refine it through reviewable Markdown changes. A human chooses the premise, audience, evidence, and what not to claim.

## How it branches

```text
Project Arc
|
+-- Score (Markdown)
|   +-- Arc frontmatter: title, theme, description
|   +-- Scene directive: layout, eyebrow, visual
|   +-- ordinary Markdown body
|
+-- Stage (React)
|   +-- parser
|   +-- layout templates
|   +-- keyboard and scene navigation
|
+-- Props (repository assets)
|   +-- diagrams
|   +-- screenshots
|   +-- optional game artwork
|
+-- Publish (static Vite build)
    +-- /arc/ GitHub Pages route
```

## Why this prototype

**Pros:** Markdown is diffable, promptable, and portable; React allows live interaction and asset reuse; static Vite output works with GitHub Pages; there is no heavyweight editor or server. The semantic directive remains small enough for an LLM and a reviewer to understand.

**Cons:** this first draft has no graphical editor, PDF export, speaker notes, animation timeline, CMS, or automatic repository fact-checking. The parser intentionally supports only a simple directive line rather than every YAML or Markdown feature. Those exclusions keep the first iteration honest and small.

## Layout-template catalog

The Stage recognizes ten starter layouts. The supplied BIS Score demonstrates them and makes each a stable name for future prompts.

| Layout | Intended beat |
| --- | --- |
| `opening` | Title, premise, first impression |
| `index` | Story map or table of contents |
| `signal` | One central product claim |
| `split` | Narrative and a contrasting visual |
| `architecture` | Boundaries, layers, systems |
| `proof` | Scope, caveat, or evidence |
| `showcase` | Assets, examples, or outcomes |
| `timeline` | Creation-to-delivery sequence |
| `closing` | Thank-you or action prompt |
| `quote` | A memorable user or project principle |

Each layout currently uses the same resilient split-stage foundation, with its own CSS treatment and a named visual. This lets the content model stabilize before introducing more complex per-layout rendering.

## Candidate names considered

1. **Project Arc** — selected: it describes a narrative shape, works for a website or recording, and gives “Scene” a natural companion.
2. **Storyrail** — energetic and sequence-oriented, but slightly product-marketing flavored.
3. **Repo Revue** — memorable for repository tours, but too narrow for game or customer stories.
4. **Narrative Loom** — good for multi-source composition, but less immediate to say aloud.

## Existing options researched

- [Slidev](https://sli.dev/) provides Markdown-first, Vite-powered developer slides; it is Vue-based and more presentation-framework-heavy than this React prototype.
- [Marp](https://marp.app/) turns extended Markdown into slides and export formats; it is excellent for documents, but less suited to a bespoke interactive project site.
- [reveal.js](https://revealjs.com/markdown/) supports Markdown, nested slides, notes, and a robust presentation runtime; it could power a future Arc, but its slide semantics are the thing this vocabulary intentionally reframes.
- [Spectacle](https://formidable.com/open-source/spectacle/) is React-native and flexible, though its authoring model is component code rather than a compact repository Score.

## Skills an eventual Arc workflow could use

1. Repository reconnaissance: inspect packages, docs, tests, and assets before drafting claims.
2. Story editor: build an audience-specific outline, then write or revise the Score.
3. Asset curator: identify safe, licensed repository assets and generate missing non-factual artwork when requested.
4. Claim verifier: link each important Scene to evidence and flag unsupported language.
5. Theme director: define palette, typography, and layout choices for the Stage.
6. Publisher: build, stage, and verify the GitHub Pages route.
7. Recording coach: produce a scene-by-scene narration outline and run-of-show.

## Try it

Run `npm run dev` and open `/arc/`. Use the buttons or Left/Right arrow keys; Home and End jump to the first and last Scene. Edit [bis-project.arc.md](stories/bis-project.arc.md) to change copy, scene order, or directives, then refresh the browser.
