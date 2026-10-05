## Context

The completed simplification provides lettered sections A-F with Stories summaries. The follow-up directly requested folding and matching User Stories typography.

## Goals / Non-Goals

Goals: independent pointer and keyboard folding with stable child state. Non-goals: accordion exclusivity, persistent fold preferences, production UI changes, and folding Console or the documentation section.

## Decisions

A shared StorySection uses native details/summary, initially open, with mounted children. The title reuses admin-section-title. A decorative > rotates 90 degrees when expanded. This preserves native keyboard semantics without additional state or dependencies.

## Risks / Trade-offs

Browser disclosure rendering varies; hide native markers and provide visible focus styling. Verify Enter/Space, state across rerenders and narrow rendering.
