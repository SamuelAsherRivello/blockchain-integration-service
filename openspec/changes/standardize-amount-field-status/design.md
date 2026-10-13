# Design

## Context

`AmountChooserRow` is shared by Send and Account Transfer. Each view currently appends independent paragraph-based feedback after the amount control and before its footer actions. Account Transfer can render both a pending-transfer prompt and a zero-amount prompt in that interval.

## Goals / Non-Goals

**Goals:**

- Give each view one standalone, stable status line below the shared amount control.
- Preserve validation, availability, direction, and pending-operation information through that one replaceable line.
- Provide concise, fixed body text beneath each page title.

**Non-Goals:**

- Change transfer eligibility, quoting, confirmation, pending-operation recovery, or direct-send validation.
- Add the status line to any view other than Send and Account Transfer.
- Change text outside the specified amount-entry guidance unless relocation is required by the layout contract.

## Decisions

### Status content belongs to each consuming view

Each consumer renders exactly one `field-status-line` after `AmountChooserRow`. The shared component remains only an amount input control. This prevents a shared control API from becoming a catch-all status channel while retaining a consistent visual position.

### One priority-selected message occupies the status line

`Set amount above.` is the default for verified positive funds with a zero amount. A single applicable message replaces it for recipient or amount validation, reverse-transfer explanation, transfer availability, over-limit amounts, recovery, or pending transfers. The line may wrap so long guidance is fully readable. Each view defines a priority order and never renders a second status field.

### Static page context and operation failures are separate

Send renders `Send balance to another address.` and Account Transfer renders `Swap between your balances.` as fixed body text below their titles. Failures returned after a user starts review or confirmation continue through the existing error prompt; inline status remains for actionable pre-action state only.

## Risks / Trade-offs

- [Relocating feedback can make a message less immediately visible] → keep each message adjacent to the control or operation state it describes and cover it with browser tests.
- [Several applicable states could compete] → define and test an explicit per-view priority order for the single status line.
- [Narrow layout changes can regress keyboard and screen-reader context] → retain `role=status` where feedback is dynamic and verify focus/action behavior in existing browser tests.
