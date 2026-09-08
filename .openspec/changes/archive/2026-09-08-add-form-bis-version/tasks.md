## 1. Implementation (after apply is requested)

- [x] 1.1 Derive the shared AccountCard version label from integration/package.json; verify it displays `BIS: v` followed by the package version without a hardcoded release value.
- [x] 1.2 Update shared header markup and CSS to anchor the faded version immediately right of the independently centered network span; verify the network midpoint matches the card midpoint, the v remains lowercase, and sticky styling is preserved.

## 2. Verification

- [x] 2.1 Extend the relevant isolated browser layout verification, updating the current Balance route and dedicated network selector if using details-layout.tsx; verify centered network geometry, metadata-derived version, no overlap/overflow at standard and narrow portrait widths, a longer version string, and sticky behavior on a scrolling form. Check representative logged-out and active forms and confirm remaining network-bearing forms share AccountCard.
- [x] 2.2 Run `npm run build` and verify development and built-library consumption both show the correct integration version; record browser results and any unrelated pre-existing failures in the change's verification notes.

