# Demo application

Admin UI is a dark, lean navigator of implemented BIS demonstrations. Categories with no implemented stories are hidden. Initially nothing is selected and Runtime Preview UI is empty.

Choose **Account / Account Button**, then click the centered production **Account** button. Create Account and Restore Account are disabled. Back restores Account; Reset Client recreates the session, clears selection, and leaves runtime content empty. The story action is disabled while Account is open. Reset preserves persisted data.

- `src/admin`: explicit story catalog and Admin UI controls.
- `src/preview`: a single 9:16 host container; no simulated game menus.
- `src/App.tsx`: selection, public context subscriptions, mounting and cleanup.
- `src/style.css`: dark demo page/navigation/frame styles only.

Runtime Preview UI uses only production factories and the public integration stylesheet. It must not duplicate production components or use admin controls. Admin UI observes production context first; `createBisAdminContext(context)` is the fallback for specific development operations.

Every new integration feature must have an Admin UI demonstration and a synchronized entry in `documentation/User Story Diagrams.md`. Catalog presence proves an available demonstration, not completion of every branch in the broader story.


Runtime Preview offers 100%, 50% (default), and 25% content scale. The outer 9:16 frame stays fixed; a demo-owned DOM layer expands inversely and is transformed to fit. At 50%, BIS receives twice the layout width/height. Changing scale preserves the mounted UI and account state; integration styles remain unchanged.

