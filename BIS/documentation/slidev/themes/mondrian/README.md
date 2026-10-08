# Mondrian Slidev theme

`mondrian` is the local Slidev theme shared by the Modrian Template catalog and the Blockchain For Gaming Master Deck. Its public layouts are the `mondrian-*` components listed in [`layout-catalog.json`](./layout-catalog.json). The catalog is the source of review examples; content decks select the same layout name in Slidev frontmatter and provide only Markdown content and declared slots.

| Layout family | Public layouts | Content inputs |
| --- | --- | --- |
| Core | `mondrian-title`, `mondrian-subsection`, `mondrian-content` | default slot |
| Comparisons | `mondrian-two-columns`, `mondrian-two-columns-header`, `mondrian-right-diagram` | default, left, right; the right-diagram layout reserves the right pane for Mermaid |
| Supporting | `mondrian-center`, `mondrian-demo`, `mondrian-quote`, `mondrian-fact`, `mondrian-image-left`, `mondrian-image-right` | default slot; image layouts accept `image` and `backgroundSize` |
| Closing/special | `mondrian-blank`, `mondrian-diagram`, `mondrian-thank-you`, `mondrian-about`, `mondrian-video-xp`, `mondrian-logos`, `mondrian-about-end-cards` | default slot |

Shared styles live in `styles/`; existing lower-level Vue files are implementation helpers for the public named layouts. Do not select a helper or a generic Slidev layout from a content deck.

## Catalog selection and capacity

The Modrian template catalog is the visible source of truth for a layout's composition. Its low-emphasis guidance lines document the following reusable limits; preserve those limits when replacing the sample content.

- **Subsection:** use one or two title lines for an explanatory transition.
- **Image Left / Image Right:** choose left when the visual establishes context and right when explanatory copy must lead; keep the supporting side concise.
- **Image Bottom:** reserve the top field for a one-line title. Choose another image layout for longer framing copy.
- **Right Diagram:** place one takeaway and no more than three short evidence points in the left pane; the diagram remains primary.
- **Blank:** use only for embedded artifacts or an intentional visual pause, not ordinary presentation content.
- **Blockchain XP / Game XP:** retain a row-major reading order and a maximum of twelve items. The galleries use motion only as enhancement and remain fully visible when the visitor prefers reduced motion.
- **Say Hi / About:** use for a relationship-first contact close. **Say Hi / End Cards** is the action-first alternative when optional end-card media or a portfolio recap supports the next step.

Catalog sample text is instructional: the TOC, fact, comparison, image, and diagram examples deliberately identify a primary element and supporting content. Keep that hierarchy when adapting the layouts for another deck.

## Reusable arrow

`MondrianArrow` is the shared directional-arrow primitive used by the image-bottom layout. Its default presentation is a 75-pixel, blue (`#2f6bff`) arrow with a 7-pixel stroke, a half-scale head, and a 90-degree (downward) rotation. An image-bottom slide places the arrow with `arrowX` and `arrowY`; all other inputs are optional instance-level refinements:

```yaml
arrowX: 380
arrowY: 180
arrowAngle: 45 # optional; default is 90 (down)
```

Use `arrowLength`, `arrowColor`, `arrowWidth`, and `arrowHeadScale` only when an instance intentionally differs from the shared default. In SVG coordinates, 0 degrees points right and 90 degrees points down.
