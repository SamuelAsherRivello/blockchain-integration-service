# Design

## Context

The prototype sandbox currently has a reusable Mermaid renderer and a completed Overview implementation for Create Wallet, while the other routes use a standalone Docs section. The change applies that presentation pattern to all 19 routes without changing the real SDK/provider operations. The existing Mermaid renderer already supports a fixed 400px diagram canvas and post-processing for the sequence diagram’s top-only participant headers.

## Goals / Non-Goals

**Goals:**

- Establish one reusable Overview component for all prototype demos.
- Keep Intro, Diagram, and Docs content specific to each operation while preserving the shared layout.
- Represent the actual boundary crossed by each operation using the confirmed four-column layer model, with a fifth External Wallet column only where required.
- Preserve the current source-code, input, execute, loading, output, recovery, and explorer behavior.
- Make tab state and panel relationships keyboard- and screen-reader-friendly.

**Non-Goals:**

- No changes to Arkade SDK calls, provider calls, contract execution, wallet persistence, or transaction handling.
- No new blockchain or off-chain behavior.
- No fabricated line through Arkade Wallet when a public read bypasses the SDK.
- No replacement of the existing Docs URLs or documentation copy.

## Decisions

### Reuse one Overview composition

Generalize the existing Create Wallet Overview into a reusable composition that accepts an Intro sentence, a Mermaid source string, documentation props, and whether the External Wallet actor is needed. Keep the existing standalone Docs and diagram wrappers available only where current non-Overview callers still require them during the refactor, then make every demo route use the Overview composition.

### Keep the actor vocabulary fixed

Use these exact standard participant labels, in order:

1. `Bitcoin` / `(On-Chain L1)`
2. `Arkade Operator` / `(Off-Chain L2)`
3. `Arkade Wallet` / `(SDK L3)`
4. `Client` / `(L3)`

External Wallet routes append `External Wallet` / `(L3)` as the fifth column. Unused actors stay visible but have no messages. This is more honest than routing every read through the SDK and more consistent than changing the actor set per ordinary demo.

### Build diagrams from actual operation boundaries

Use the implementation as the source of truth for message lines:

- Create Wallet: Client, Arkade Wallet, and Operator participate in wallet initialization/address derivation; Layer 1 is context only.
- Private balance, payment history, Send Payment, Mint Asset, Send Asset, and private Asset History: Client ↔ Arkade Wallet ↔ Arkade Operator; Layer 1 is not shown as participating unless the operation implementation actually crosses it.
- Public balance, Receive Payment, Receive Asset, and public Asset History: Client ↔ Arkade Operator; Arkade Wallet and Layer 1 remain unconnected.
- Onboard and Offboard Bitcoin: Client ↔ Arkade Wallet ↔ Arkade Operator ↔ Bitcoin, with the settlement direction reflected in the labels.
- Conditional Vault Create, Increment, Check, and Claim: use one diagram per action. Include Layer 1, Operator, Wallet, and Client only where the current contract path uses them; Check remains a public inspection path rather than a signing path.
- External Wallet send and receive: include External Wallet as the fifth actor and show the wallet-link popup/callback path, keeping internal Arkade Wallet distinct from the external app.

The exact message wording should remain short and user-facing. It must describe requests, responses, handoffs, or verified transaction steps rather than internal implementation details.

### Keep tab panels naturally sized

The Overview shell has no fixed panel height. Intro and Docs use natural content height. Diagram retains the existing 400px canvas and horizontal scrolling only when the five fixed actors exceed the available width. The tab panel itself does not introduce a vertical scrollbar.

### Preserve docs and source behavior

Move the existing documentation props from each route’s standalone DocsSection into the Overview Docs tab. OperationDemo remains responsible for inputs, source views, action controls, loading prompts, output, recovery, and contract-source tabs; Overview owns only the pre-operation explanatory content.

## Risks / Trade-offs

- [Risk] A diagram could imply a network path that the implementation does not take. → Derive each sequence from the route’s current SDK/provider code and keep unused actors unconnected.
- [Risk] The fixed actor set can make a simple public read look sparse. → Preserve the four columns and use concise direct Client-to-Operator messages rather than inventing SDK calls.
- [Risk] Conditional Vault actions have substantially different trust and settlement behavior. → Define separate action diagrams and review them against the existing contract source and README before implementation.
- [Risk] Existing tests assert standalone Docs ordering and old labels. → Update route and browser assertions to verify Overview tabs, all 19 routes, exact actor labels, and preserved docs links.
- [Risk] Mermaid’s SVG structure may vary between versions. → Keep the current renderer post-processing localized and validate the rendered diagrams through build and browser smoke coverage.
