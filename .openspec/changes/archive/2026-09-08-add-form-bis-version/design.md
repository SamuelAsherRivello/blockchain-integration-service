## Context

AccountCard.tsx owns the shared Network: Signet header. overlay.css gives it a sticky yellow strip, centered text, and uppercase styling. The integration package version is currently 0.14.0. TypeScript already enables resolveJsonModule, and consumers can load either development source or the built library. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:** Keep the network text independently centered and derive a consistent version from the integration package in both source and distribution usage.

**Non-Goals:** Change wallet flows, add dependencies, expose a new API, or bump release metadata.

## Decisions

- Import the version from integration/package.json in the integration UI (directly or through a small internal constant). Vite bundles that value with the running library. Hardcoding 0.14.0 would drift; reading the consuming app's version would identify the wrong product. A build-only define would require extra wiring for consumers of development source.
- Keep the strip sticky and place a centered network span inside it. Anchor the version immediately after that span with positioning that does not contribute to the network's centering width. Centering a combined flex row would shift the network left and violate the request.
- Give only the version a separate muted style, initially around 30% opacity with a small gap. Override inherited uppercase styling for its literal `BIS: v` prefix. Preserve the network styling. Tune spacing and fade through browser inspection at the existing card size and narrow preview widths.
- Apply this once in AccountCard so all forms using the existing header inherit it. The version is informational text without an interaction or focus stop.

## Risks / Trade-offs

- [Version length or narrow cards could clip the label] → Check the current version and a longer semantic version in narrow and standard preview layouts; adjust version typography and gap without shifting the network.
- [Existing layout assertion expects the whole strip text to equal Network: Signet] → Target the dedicated network span when extending relevant verification. The existing details-layout harness also assumes an older direct Balance route; use the current route when exercising it.
- [Source and bundled consumers could differ] → Verify both development and library build output use integration package metadata.
- [Concurrent local CSS edits] → Keep the implementation patch limited to the shared header and preserve unrelated changes.

## Migration Plan

No data migration. Implement the shared UI change, build, and verify with isolated browser fixtures. Rollback is an additive revert of the presentation change; no storage or wallet operations are needed.
