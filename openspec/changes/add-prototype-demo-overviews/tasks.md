# Tasks

## 1. Shared Overview presentation

- [x] 1.1 Refactor the existing Create Wallet Overview into a reusable tabbed Overview composition that accepts demo-specific Intro, Diagram, and Docs content while preserving the existing Input, Demo, Output, loading, recovery, and source-code regions; verify the prototype package typecheck/build still succeeds.
- [x] 1.2 Implement accessible Overview tabs with selected state, tab/panel relationships, keyboard activation, natural Intro/Docs height, and the existing 400px diagram canvas with horizontal-only overflow; verify with focused browser or component assertions at wide and narrow viewport sizes.
- [x] 1.3 Preserve the existing DocsSection and OperationDemo behavior for all content outside Overview while moving each route’s existing Docs props into its Overview Docs tab; verify no duplicate standalone Docs section appears on any of the 19 routes.

## 2. Diagram catalog

- [x] 2.1 Add the shared Mermaid participant labels in the confirmed order: Bitcoin `(On-Chain L1)`, Arkade Operator `(Off-Chain L2)`, Arkade Wallet `(SDK L3)`, and Client `(L3)`; verify rendered SVG text contains the exact labels and the existing top-only actor styling remains intact.
- [x] 2.2 Add operation-specific sequence sources for Create Wallet, private/public balance, Onboard, Offboard, Send Payment, Receive Payment, Payment History, Mint Asset, Send Asset, Receive Asset, and private/public Asset History; verify each source parses and does not add connections through unused layers.
- [x] 2.3 Add separate sequence sources for Conditional Vault Create, Increment, Check, and Claim based on their actual contract paths; verify Check remains a public inspection path and no diagram claims signing or settlement that its implementation does not perform.
- [x] 2.4 Add the rightmost External Wallet `(L3)` participant and dedicated sequences for External Wallet send and receive, including wallet-link handoff and callback behavior; verify the diagrams distinguish External Wallet from the internal Arkade Wallet SDK.
- [x] 2.5 Add focused diagram-catalog tests covering all 19 routes, fixed actor ordering, exact layer labels, external-wallet fifth-column behavior, and representative direct Client-to-Operator versus SDK-mediated flows.

## 3. Demo-specific Overview content

- [x] 3.1 Add broad-audience Intro sentences beginning with “Demonstrates” for every demo route, including the Create Wallet wording “Demonstrates creating a wallet from scratch.”; verify each route exposes nonempty page-specific Intro content.
- [x] 3.2 Integrate Overview into the two balance demos, both Bitcoin boarding demos, payment demos, asset demos, and both asset-history demos without changing their real SDK/provider operations; verify route coverage and existing source/output labels with the prototype tests.
- [x] 3.3 Integrate Overview into all four Conditional Vault demos without changing contract execution, recovery, compiled-source, or descriptor behavior; verify each action retains its existing inputs, source tabs, Execute/Recover controls, and output.
- [x] 3.4 Integrate Overview into both External Wallet demos without changing popup, callback, postMessage, or payment behavior; verify the existing external-wallet guidance remains in Docs and callback smoke tests continue to pass.
- [x] 3.5 Update navigation and demo assertions for the Create Wallet name and the new Overview-first ordering while preserving all 19 route paths; verify navigation and demo-coverage tests pass.

## 4. Integrated verification

- [x] 4.1 Run the prototype sandbox unit and route tests and verify all 19 demos render an Overview with Intro, Diagram, and Docs tabs.
- [x] 4.2 Run the prototype sandbox browser smoke coverage and verify tab switching, diagram rendering, Docs links, narrow-layout behavior, and representative external-wallet and Conditional Vault routes.
- [x] 4.3 Run `npm run build --workspace @spike/prototype-sandbox` and verify the build succeeds without Mermaid parse/render failures; record any pre-existing bundle-size warnings without treating them as feature failures.
