# Demo application

Admin UI is a dark, lean navigator of implemented BIS demonstrations. Categories with no implemented stories are hidden. Initially nothing is selected and Runtime Preview UI is empty.

Choose **Account / Account Button** for entry or **Account / Create Account** to open the production dialogue directly. Create Account generates a real Signet identity, displays the private recovery phrase, and saves/activates only on Continue. Saved accounts survive reload and browser restart; the admin selection does not. The minimal logged-in dialogue contains disabled Log Out and Back. Restore and functional logout remain unavailable.

Reset Client clears BIS account storage and transient state, recreates the session, clears selection, and leaves runtime content empty. It remains enabled for a saved account even without a selected story. Real deletion-based reset checks must be completed manually under the repository database rule; reset lifecycle tests use isolated in-memory doubles.

- `src/admin`: explicit story catalog and Admin UI controls.
- `src/preview`: a single 9:16 host container; no simulated game menus.
- `src/App.tsx`: selection, public context subscriptions, mounting and cleanup.
- `src/style.css`: dark demo page/navigation/frame styles only.

Runtime Preview UI uses only production factories and the public integration stylesheet. It must not duplicate production components or use admin controls. Admin UI observes production context first; `createBisAdminContext(context)` is the fallback for specific development operations.

Every new integration feature must have an Admin UI demonstration and a synchronized entry in `documentation/User Story Diagrams.md`. Catalog presence proves an available demonstration, not completion of every branch in the broader story.


Runtime Preview offers 100%, 50% (default), and 25% content scale. The outer 9:16 frame stays fixed; a demo-owned DOM layer expands inversely and is transformed to fit. At 50%, BIS receives twice the layout width/height. Changing scale preserves the mounted UI and account state; integration styles remain unchanged.

