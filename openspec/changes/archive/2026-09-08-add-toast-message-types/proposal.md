## Why

Toasts currently share a neutral background and optional artwork, making progress, warnings, failures and success difficult to distinguish. The user requests four MessageType values with matching backgrounds and icons, and sentence-case messages without a category prefix.

## What Changes

- Add MessageType values info, warning, error and success, with info as the backward-compatible default.
- Preserve the current compact toast design, placement and animation while adding blue information, amber warning, red error and green success treatments and distinct icons.
- Show the icon and message without visible Info:, Warning:, Error: or Success: prefixes.
- Apply sentence case to built-in toast wording, preserving Arkade, Bitcoin, acronyms and exact identifiers. Do not change arbitrary host-supplied strings or identifiers automatically.
- Assign types to all current BIS/demo toast producers, including dynamic pay-to-continue errors. Preserve existing trophy/image support alongside the type icon.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `toast-messaging`: Typed presentation, built-in message case and producer classification.

## Impact

Core toast options/queue, public exports, ToastViewport, overlay CSS, notification/continue/collection producers and demo calls, plus their tests and documentation. No new dependencies or wallet behavior changes. The recent F3 receipt timing and verification remain unchanged. Existing exact-message specs must be reconciled with this change's authoritative sentence-case policy when syncing; no payment semantics are superseded.
