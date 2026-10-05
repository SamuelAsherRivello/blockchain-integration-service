# Mondrian Slidev theme

`mondrian-final` is the local Slidev theme shared by the Modrian Template catalog and the Blockchain For Gaming content deck. Its public layouts are the `mondrian-*` components listed in [`layout-catalog.json`](./layout-catalog.json). The catalog is the source of review examples; content decks select the same layout name in Slidev frontmatter and provide only Markdown content and declared slots.

| Layout family | Public layouts | Content inputs |
| --- | --- | --- |
| Core | `mondrian-intro`, `mondrian-subsection`, `mondrian-content` | default slot |
| Comparisons | `mondrian-two-columns`, `mondrian-two-columns-header`, `mondrian-right-diagram` | default, left, right; the right-diagram layout reserves the right pane for Mermaid |
| Supporting | `mondrian-center`, `mondrian-quote`, `mondrian-fact`, `mondrian-image-left`, `mondrian-image-right` | default slot; image layouts accept `image` and `backgroundSize` |
| Closing/special | `mondrian-blank`, `mondrian-diagram`, `mondrian-thank-you`, `mondrian-about`, `mondrian-video-xp`, `mondrian-logos`, `mondrian-about-end-cards` | default slot |

Shared styles live in `styles/`; existing lower-level Vue files are implementation helpers for the public named layouts. Do not select a helper or a generic Slidev layout from a content deck.
