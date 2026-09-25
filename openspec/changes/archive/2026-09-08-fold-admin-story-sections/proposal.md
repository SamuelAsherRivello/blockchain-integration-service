## Why

Long Admin story sections need folding controls so users can focus on the relevant group. This records the already implemented and browser-verified user request before sync and archive.

## What Changes

- Make A-F independently foldable, initially expanded.
- Place a > chevron before each title, pointing down while expanded.
- Match title font size, weight and color to User Stories.
- Preserve child state and existing control behavior while folded.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `story-driven-demo`: Foldable story sections and consistent headings.

## Impact

Demo-only StorySection.tsx, AdminPanel.tsx, GameWalletPanel.tsx and style.css. No public APIs, wallet operations, storage changes or dependencies.
