---
theme: ./themes/mondrian-final
colorSchema: dark
layout: mondrian-intro
title: Blockchain For Game
author: Samuel Asher Rivello
aspectRatio: 16/9
canvasWidth: 1280
class: b-safe-intro
contentSlide: 1
contentSlideId: p1
templateLayout: mondrian-intro
catalogSlide: 1
---

# Blockchain For Game

## Four lenses for building better games


---
layout: mondrian-subsection
contentSlide: 2
contentSlideId: g3e50a99ab1a_1_76
templateLayout: mondrian-subsection
catalogSlide: 2
---

# Blockchain For Game Designers

## Player value starts with the game loop

---
layout: mondrian-content
contentSlide: 10
contentSlideId: g3e50a99ab1a_1_9441
templateLayout: mondrian-content
catalogSlide: 3
---

# Design the loop before the asset

Players return when each action creates a clear next decision.

- Make the core loop legible without blockchain.
- Add ownership where it changes player behavior.
- Reward mastery, contribution, or discovery.

---
layout: mondrian-two-columns
contentSlide: 11
contentSlideId: g3e50a99ab1a_1_9459
templateLayout: mondrian-two-columns
catalogSlide: 4
---

# Rewards should serve the loop

::left::

## Strong reward

The reward gives players a reason to continue the next session.

::right::

## Weak reward

The reward exists only because the system can mint it.

---
layout: mondrian-subsection
contentSlide: 13
contentSlideId: h71ce93168c13465f_0_31
templateLayout: mondrian-subsection
catalogSlide: 2
---

# Blockchain For Game Developers

## Integrate only where the system earns its complexity

---
layout: mondrian-two-columns-header
contentSlide: 14
contentSlideId: p42
templateLayout: mondrian-two-columns-header
catalogSlide: 5
---

# What every blockchain game needs

::left::

## A game layer

Fast feedback, readable rules, and a reason to return.

::right::

## A trust layer

Portable ownership, verifiable state, and predictable settlement.

---
layout: mondrian-content
contentSlide: 15
contentSlideId: h71ce93168c13465f_0_11
templateLayout: mondrian-content
catalogSlide: 3
---

# Choose the boundary deliberately

Keep real-time play and private game state close to the game.

Move durable ownership, settlement, or shared inventory to the chain.

The integration boundary should follow player value, not technical novelty.

---
layout: mondrian-subsection
contentSlide: 40
contentSlideId: g3fb61a5d5fe_0_75
templateLayout: mondrian-subsection
catalogSlide: 2
---

# Bitcoin: Layer 2 For Games

## Match the game’s needs to the right layer

---
layout: mondrian-two-columns
contentSlide: 41
contentSlideId: g3fb61a5d5fe_0_86
templateLayout: mondrian-two-columns
catalogSlide: 4
---

# Bitcoin layers in one picture

::left::

## Layer 1

Maximum settlement assurance. Limited throughput and higher cost.

## Layer 2

Faster, cheaper activity anchored to Bitcoin.

::right::

## Layer 3

Application-specific execution for a focused game or service.

The layers compose when each one has a clear job.

---
layout: mondrian-content
contentSlide: 42
contentSlideId: g3fb61a5d5fe_0_101
templateLayout: mondrian-content
catalogSlide: 3
---

# The Layer 2 landscape

Payment channels optimize rapid exchange.

Sidechains and federated systems add programmable environments.

Rollup-style approaches batch activity before settlement.

The right choice depends on custody, latency, liquidity, and trust assumptions.

---
layout: mondrian-two-columns
contentSlide: 50
contentSlideId: g3fb61a5d5fe_0_18
templateLayout: mondrian-two-columns
catalogSlide: 4
---

# Ark and Arkade

::left::

## Ark

A Bitcoin-native coordination model for off-chain activity with periodic settlement.

::right::

## Arkade

An application layer that makes Ark-style primitives usable inside game economies.

The design question is simple: which player actions need Bitcoin settlement?

---
layout: mondrian-subsection
contentSlide: 34
contentSlideId: h71ce93168c13465f_0_17
templateLayout: mondrian-subsection
catalogSlide: 2
---

# Blockchain Gaming Case Study

## BIS and Stealth & Steel

---
layout: mondrian-content
contentSlide: 37
contentSlideId: g3faa3cf280c_1_0
templateLayout: mondrian-content
catalogSlide: 3
---

# BIS turns integration into a game service

The Blockchain Integration Service separates game code from wallet and settlement details.

- A game-facing interface hides chain-specific plumbing.
- Admin tooling makes the integration visible and testable.
- The architecture leaves room for Bitcoin, Arkade, and future layers.

---
layout: mondrian-two-columns
contentSlide: 35
contentSlideId: p41
templateLayout: mondrian-two-columns
catalogSlide: 4
---

# Stealth & Steel makes the loop concrete

::left::

## Game layer

Players make tactical decisions, complete missions, and improve their loadout.

::right::

## Blockchain layer

Durable items and player identity can persist beyond one session or storefront.

The chain supports the game’s economy instead of replacing the game.

---
layout: mondrian-content
contentSlide: 37
contentSlideId: g3faa3cf280c_1_0
templateLayout: mondrian-content
catalogSlide: 3
---

# A practical integration sequence

1. Prototype the game loop with local state.
2. Identify the state players need to own or verify.
3. Put only that state behind the service boundary.
4. Measure installs, engagement, retention, and revenue.

---
layout: mondrian-subsection
contentSlide: 51
contentSlideId: p45
templateLayout: mondrian-subsection
catalogSlide: 2
---

# The takeaway

Blockchain becomes useful when it improves a game decision players already care about.

---
layout: mondrian-about
contentSlide: 37
contentSlideId: g3faa3cf280c_1_0
templateLayout: mondrian-about
catalogSlide: 17
---

# <span class="primary-label-one-line" style="display: inline-block; transform: translateY(-10px)">About me</span>

## Samuel Asher Rivello

- Senior game developer and blockchain integration builder
- [SamuelAsherRivello.com](http://samuelasherrivello.com)
- [LinkedIn.com/in/SamuelAsherRivello](https://www.linkedin.com/in/SamuelAsherRivello)

---
layout: mondrian-end
contentSlide: 51
contentSlideId: p45
templateLayout: mondrian-end
catalogSlide: 14
---

# End Screen

## Questions, experiments, and the next build
