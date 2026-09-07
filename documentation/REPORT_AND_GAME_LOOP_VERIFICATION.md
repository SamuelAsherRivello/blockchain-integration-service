# Report pagination and game account verification — 2026-09-06

Long transaction, asset clipboard-fallback, and recovery reports now paginate by the rendered textarea dimensions. Previous/Next replaces internal report scrolling. Copy exports the complete original report regardless of the selected page. Manual clipboard fallback exposes all pages without dropping or altering characters. Transaction and asset lists retain their existing scrolling behavior.

The runtime intersects its host bounds with the visible browser viewport, accounting for host scaling. Resizing or panning the visual viewport keeps a focused account input within the scrollable card. This addresses keyboard occlusion while preserving the host's game geometry.

## Verification

- BIS typecheck and production build passed.
- Focused account restoration, restart, logout, transaction-detail, and transfer-report Node test files passed (5 files).
- Report browser fixture passed: 80 long Unicode lines, exact reconstruction across pages, full Copy, resizing to 240/280/360 px host widths, no textarea or card scrolling.
- Existing transaction, asset, recovery, restore, pending-operation and demo browser fixtures passed. Fixtures use isolated storage and mocked operations.
- Game production build passed; all 107 existing game tests passed.
- Production game browser run used a fresh Pixel 7 Chromium profile and the real Signet SDK/service. Create → Continue → reload → confirmed logout → game restart → restore → reload retained the identical public Account ID at each connected stage. No funds or payments were involved. Recovery words stayed in transient test/browser memory and were not logged or saved to artifacts.
- Android browser emulation covered 360×640, 393×700, 412×915, and a reduced 360×320 viewport. The focused last recovery word remained visible. Real key events also verified space-to-next-word advancement and that recovery input does not move the game. A simulated visualViewport height of 320 px with an 80 px vertical offset covered keyboard overlay/panning and dismissal.

Physical Android hardware and an actual Android keyboard were not available. Emulated geometry does not establish physical-device keyboard compatibility.

The running game development server retained an old optimized dependency after installation. Verification therefore used a fresh production preview of the rebuilt game on port 4176. Restart the existing development server when using its old preview to pick up the new package.

## Reproduction

Serve the game production build. Run `scripts/smoke-game-account-loop.mjs <game-url>` with Playwright available; `PLAYWRIGHT_MODULE` and `SMOKE_CHROMIUM_EXECUTABLE` can select an existing installation. The script always creates a disposable browser profile, never accesses a user's saved browser profile, and requires access to the Signet service.

For report regression coverage, serve the BIS demo and open `/tests/report-pages-host.html`, then Run. Existing `/tests/activity-host.html`, `/tests/account-assets-host.html`, `/tests/recovery-report-host.html`, and `/tests/activity-recovery-host.html` cover report integration and copying.
