---
title: Blockchain Integration Service
theme: midnight-signal
description: A ten-scene product story for BIS and its game consumer.
---

<!-- arc: layout=opening; eyebrow=PROJECT ARC / PROTOTYPE; visual=signal -->
# Blockchain Integration Service

## Bitcoin-shaped game systems, presented as one story.

**BIS** is a proof of concept for bringing accounts, payments, assets, and contracts into a game without making the game itself become a wallet product.

---

<!-- arc: layout=index; eyebrow=THE ARC; visual=map -->
# The story map

1. The opportunity
2. The player journey
3. The service boundary
4. Payments and assets
5. Stealth & Steel
6. A GitHub-friendly delivery path

> Ten scenes. One browser link. No presentation file to hand around.

---

<!-- arc: layout=signal; eyebrow=01 / THE OPPORTUNITY; visual=bitcoin -->
# A game should not need to become a wallet

BIS is a reusable integration layer for games exploring Bitcoin Signet and Mutinynet use cases.

- Keep game play and game identity in the game.
- Put account and blockchain-adjacent behavior behind a public API.
- Make complex operations visible in a developer-facing demo before a game adopts them.

---

<!-- arc: layout=split; eyebrow=02 / THE PLAYER JOURNEY; visual=journey -->
# Start with a player, not a transaction

The visible path is deliberately human-sized:

1. A game exposes an Account entry point.
2. A player creates or restores access when they choose.
3. The game can continue to be playable while account capabilities are unavailable.
4. Clear state and feedback keep the boundary honest.

> An account is an opt-in capability, not a prerequisite for fun.

---

<!-- arc: layout=architecture; eyebrow=03 / THE SERVICE BOUNDARY; visual=bis-diagram -->
# One integration, multiple game surfaces

The reusable `@bis/integration` package owns runtime UI, state, and adapter seams. A separate integration demo composes the Admin controls and portrait preview.

- **Integration:** reusable client-facing building blocks.
- **Integration Demo:** testable Admin and runtime composition.
- **Marketplace:** a separate consumer surface for equipment catalog interactions.

---

<!-- arc: layout=proof; eyebrow=04 / PAYMENTS; visual=flow -->
# Payments are a game mechanic when they earn their place

BIS explores player-facing deposits and withdrawals, as well as pay-to-play mechanics, through selected Bitcoin test networks.

The prototype story does not imply a production financial product. Instead it makes the boundaries, state, and pending-operation feedback visible while developers experiment.

---

<!-- arc: layout=showcase; eyebrow=05 / ASSETS; visual=assets -->
# Equipment, achievements, and scarce moments

Assets can connect an in-game moment to a player-facing collection.

- Marketplace equipment gives the catalog a concrete consumer surface.
- Achievement art makes player progress visible.
- Limited-time offers point toward contracts without pretending the work is already complete.

---

<!-- arc: layout=split; eyebrow=06 / GAME CONSUMER; visual=stealth -->
# Stealth & Steel makes the boundary matter

Stealth & Steel is the game-side story: a consumer that can keep its own play loop, visuals, and game decisions while selectively mounting BIS capabilities.

That separation is the point. BIS can be useful to another game only if the game does not inherit a demo application's assumptions.

---

<!-- arc: layout=timeline; eyebrow=07 / DELIVERY; visual=github -->
# Source, stage, publish

This Arc is intentionally simple to iterate with AI:

1. Curate a Markdown **Score** with a Scene layout directive.
2. Let the React **Stage** render it at 16:9.
3. Build it as static files and stage it at `/arc/` for GitHub Pages.

> The Markdown stays reviewable in a pull request; the rendered story stays easy to rehearse in a browser.

---

<!-- arc: layout=closing; eyebrow=NEXT ARC; visual=signal -->
# Thank you

## The next prompt starts the next story.

Create an Arc, choose a theme, name the Scenes, and let a repository provide the evidence. Human curation decides what the audience should remember.
