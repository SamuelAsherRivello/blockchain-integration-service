# Design

## Context

See [proposal.md](proposal.md). The restoration flow already validates a complete BIP39 phrase locally, verifies the selected operator before deriving an address, and persists encrypted profiles separately by network. It currently treats every successful restoration as immediate save-and-activate.

## Goals / Non-Goals

**Goals:**

- Distinguish an existing local restoration from first local setup of the same derived identity on the selected network.
- Require the user to explicitly confirm first local setup while retaining the current privacy, operator-validation, role-conflict, and durable-save guarantees.
- Let test users reuse one recovery phrase to establish independent local profiles on separate supported test networks.

**Non-Goals:**

- Detecting accounts, history, or usage on remote devices, origins, or other networks.
- Copying, migrating, or merging balances, assets, activity, operations, or persistence between networks.
- Adding network-side registration, a service, a new public game-facing API, or a recovery-phrase-based network auto-detection feature.

## Decisions

### Gate first local persistence after operator verification

After valid phrase input, derive the public profile identifier only after the selected operator has confirmed its own network identity. Then look up the profile collection in that exact network scope. This preserves the existing safety boundary: an unavailable or mismatched operator cannot lead to a save, activation, or a misleading creation prompt.

The alternative—prompting from phrase entry alone—would allow users to approve an account before the selected network is known to be usable.

### Treat the prompt as a local-profile decision

The prompt appears only when no matching locally stored profile exists for the derived identity and selected network. Its text describes creation on that network without asserting a remote fact. Existing same-network profiles continue through restoration with no additional confirmation.

The alternative—trying both operators or inspecting a public address to determine where the phrase “exists”—is unreliable, exposes extra network requests, and conflicts with the separate-network model.

### Reuse recovery-flow cancellation and activation boundaries

Cancel clears only the transient recovery material and returns to the logged-out account dialog. Create Account uses the same role-conflict check and durable-save-before-activation boundary as restoration. The account is marked active only after durable save succeeds.

The alternative—creating a network-side account or copying the other network's state—does not match the Arkade wallet model and would create false expectations about balance and history portability.

## Risks / Trade-offs

- [A user interprets “does not have an account” as a claim about the wider network] → Scope the decision to an absent local profile and avoid claims about remote history or registration.
- [A saved profile is mistakenly checked outside the selected network] → Keep the lookup and collection mutation explicitly network-scoped and add cross-network regression coverage.
- [A confirmation path bypasses existing role-conflict or persistence guards] → Route Create Account through the same checks and save/activation handoff as the verified restore path.

## Migration Plan

Existing saved profiles remain valid and continue to restore immediately within their stored network scope. No data migration is required. If the new confirmation path is reverted, no profile created through it requires special cleanup because it uses the existing encrypted profile collection.
