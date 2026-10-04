# Project Arc scene templates

An Arc Score is normal Markdown separated by `---`. Start with Arc frontmatter, then add one directive before each Scene body. The directive selects a named layout and optional Visual; the Markdown stays easy to read in GitHub.

```md
---
title: My project story
theme: midnight-signal
description: A one-line audience promise.
---

<!-- arc: layout=opening; eyebrow=PROJECT ARC; visual=signal -->
# My project

## The idea worth remembering.

---

<!-- arc: layout=split; eyebrow=01 / CONTEXT; visual=journey -->
# A clear scene title

Plain **Markdown** copy, bullets, links, and blockquotes work here.
```

## Starter scene recipes

| Layout | Prompt shorthand | Best content |
| --- | --- | --- |
| `opening` | “Open with title and one-line promise” | `#` title and `##` lead |
| `index` | “Show the journey in six beats” | numbered list |
| `signal` | “Make one claim, then support it” | short paragraphs and bullets |
| `split` | “Explain the audience journey beside a visual” | steps plus a quote |
| `architecture` | “Map the boundaries” | layers and responsibilities |
| `proof` | “State scope and caveat” | evidence and clear limits |
| `showcase` | “Show concrete outcomes” | asset or feature examples |
| `timeline` | “Explain source to publish” | ordered delivery steps |
| `closing` | “End with an invitation” | thank-you and next action |
| `quote` | “Pause on a memorable principle” | one short quotation |

The prototype maps these layouts onto a common responsive Stage so all Scenes remain presentable. A later iteration can give each recipe a specialized React renderer while keeping this Score format stable.
