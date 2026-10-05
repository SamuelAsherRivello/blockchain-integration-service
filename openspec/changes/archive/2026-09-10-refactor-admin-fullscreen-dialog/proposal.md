## Why

The Mint Asset modal is currently a one-off layout, even though another Admin workflow will soon need the same large dialog treatment. Extracting a reusable Admin dialog now gives both workflows a consistent shell while making the mint screen easier to scan.

## What Changes

- Add a reusable `AdminDialogFullscreen` component owned by the integration demo's Admin UI.
- Size the dialog with 10% viewport margin above and below and 25% viewport margin at the left and right.
- Replace the Mint Asset back-arrow close control with an `X` close control in the upper-right corner.
- Recompose Mint Asset content in this order: Quick fill, Preview, then Form, while retaining the existing preset, preview, destination, and field behavior.
- Add a leading Clear action to Quick fill that restores a fresh default mint draft while retaining the selected destination.
- Place Destination and read-only Control Asset side by side at equal widths to save vertical space.
- Render the Icon URL image in a fixed-size Preview whenever the field has a value, without changing the Preview footprint as the URL changes.
- Present mint guidance, validation, progress, results, and errors as console output below the Mint/Done button.
- Preserve modal focus containment/restoration, idle dismissal, pending-operation locking, wallet selection, recovery, validation, and mint behavior.

## Capabilities

### New Capabilities

- `admin-dialog-fullscreen`: Defines the reusable Admin-owned fullscreen dialog shell, viewport margins, close control, accessibility, and scrolling behavior.

### Modified Capabilities

- `story-driven-demo`: Changes the C1 Mint Asset dialog composition and relocates its status text into console output below the primary action.

## Impact

The change affects the integration demo's Admin React components, Mint Asset markup and styles, focused UI fixtures/tests, and the story-driven demo specification. It does not change the public integration API, wallet operations, persistence, Runtime Preview, or dependencies.
