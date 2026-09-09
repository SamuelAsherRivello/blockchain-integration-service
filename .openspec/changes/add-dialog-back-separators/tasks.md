## 1. Implementation after apply is requested

- [x] 1.1 Add the shared decorative Back separator style in `BIS/packages/integration/src/ui/overlay.css`; verify three faint 2px dots centered above Back and small clearance without changing button dimensions or hit targets.
- [x] 1.2 Apply the modifier to Back buttons in `client.tsx`, `RestoreAccount.tsx`, `AccountSend.tsx`, `AccountTransfer.tsx`, `AccountActivity.tsx`, `AccountAssets.tsx`, and `recovery-window.ts`; verify every production Back render site uses it and dialogs without Back gain no separator.

## 2. Verification

- [ ] 2.1 Inspect all affected dialog families using existing browser fixtures, including single-action and nested views; verify one separator per Back, unchanged keyboard behavior and disabled states, and reachable buttons in narrow 9:16 and short hosts. Store non-secret screenshots under `output/screenshots/dialog-back-separators/`.
- [x] 2.2 Run `npm run build` and relevant existing account, restoration, send, transfer, asset, activity, and recovery UI checks; record results and any pre-existing failures separately in `output/reports/dialog-back-separators/`.
