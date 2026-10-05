# Slidev local-server issues

## What is running

The Slidev homepage at `http://localhost:3032/` is a Vite launcher, not the
presentation server itself. Each deck and template has its own Slidev/Vite
development server on a separate localhost port. The launcher proxies the
homepage links to those servers so that every presentation can be opened from
one browser origin.

The 12-hour stable-preview supervisor starts and checks that whole inventory.
It is intentionally a local-development arrangement: it supports live reload,
the browser Slidev editor, and independent themes. It is not a static export
or production deployment.

## Why the editor and rendered slide could disagree

Slidev's built-in side editor reads and saves a per-slide JSON API at the
root-relative path `/__slidev/slides/<slide-number>.json`. The master deck is
mounted behind the launcher at
`/slidev/blockchain-for-game-master-deck/`, so that root-relative request must
be proxied from port 3032 to the master deck on port 3051. If it is blocked,
rewritten to the wrong base path, or served from an HTTP cache, the editor can
show a prior slide record while the presentation shows the current compiled
slide.

The launcher now forwards that API unchanged and marks its responses
`Cache-Control: no-store, max-age=0`. This prevents a browser from reusing an
older slide record after changing slides or after an external markdown edit.
The same browser check confirmed that the editor record, render record, and
revision match for the affected master slides.

## Stale compiled slide modules

There is a separate development-server failure mode: after slides are edited,
inserted, or reordered, Slidev can retain an old generated Vue module such as
`blockchain-for-game-master-deck.md__slidev_51.md`. In that case the editor API
still parses the current Markdown correctly, but the displayed route can render
the component that belonged to the following or previous slide. Browser cache
settings cannot correct this because the stale component is held in the master
Slidev/Vite process.

The observed example was route 51 rendering route 52's “7 weeks” fact even
though the editor correctly reported the Buffett quote for 51. Restarting only
the master deck server on port 3051 regenerated the virtual modules; afterwards
both rendered routes and their editor revisions matched. No Markdown content
needed to be changed. If this precise symptom returns, restart the master deck
through the stable-preview supervisor and then reload the affected page.

Slidev also persists navigation state through `@server-reactive/nav` and
`@server-ref/nav`. Those writes are not source edits and are acknowledged with
`204` by the proxy and master Vite configuration. This is deliberately separate
from `/__slidev/slides/...`, which remains writable for the real editor save
operation.

## Why the landing page seemed to stop

The supervisor previously recovered every template and deck before it checked
the landing server. A slow or failed deck start could therefore postpone a
landing restart for the duration of the full sweep. The supervisor now checks
the landing server first, recovers the remaining servers, then checks the
landing server again before testing proxy routes. This keeps the editing entry
point available even when another presentation is recovering.

## Stable runtime and operator workflow

`scripts/live-preview-manifest.mjs` is the only declared inventory. It defines
each deck's npm script, Markdown entry, direct port, shared-origin base route,
landing visibility, and editor owner. The Vite launcher derives its proxy and
landing links from it; the Node supervisor and browser verifier consume the
same entries. Add or remove a preview only through that manifest and its npm
script—never by copying an array into the launcher or a supervisor.

For every manifest edit, run `node --test scripts/test-live-preview-manifest.mjs`.
It verifies the declared package script, derived shared-origin route, landing
metadata, and editor-proxy owner for each deck before the preview is started.

Start or inspect the preview from `BIS/documentation/slidev`:

```powershell
npm run dev:stable-preview
npm run preview:status
npm run verify:live-preview:fast
npm run verify:live-preview
```

The no-window Windows task `BIS-Slidev-Stable-Preview` runs
`scripts/slidev-live-preview-host.ps1`, which invokes the same Node runtime for
12 hours. It creates a session ledger, structured events, and current status
under `output/logs/slidev-landing/`; browser reports and failure screenshots go
under `output/reports/slidev-live-preview/`. The status endpoint is
`http://localhost:3032/__slidev/preview-status.json`. It exposes ports,
ownership, recovery count, and probe results only—never slide content or save
requests.

The supervisor uses strict port 3032. A listener it did not start is never
terminated. If it cannot prove ownership it records a `blocked` port conflict
instead of allowing Vite to silently move to port 3033. Recovery checks the
landing first and again after deck recovery; healthy deck listeners are left
untouched.

The browser integration fixture is deliberately excluded from the landing
page. It saves a unique token through the normal editor API, requires the
generated component and rendered route to show it within five seconds, and
restores the fixture source in `finally`. It never writes an author deck.

The full verifier inspects the editor record, generated Slidev virtual module,
rendered route, and HMR socket for every declared slide. A stale virtual module
is actionable evidence for recycling only that deck server; do not alter the
author Markdown merely to clear a generated-module mismatch.

## Are we using Slidev correctly?

Yes. Editing Markdown through Slidev's browser editor and relying on HMR is a
supported development workflow. The complexity comes from serving many
independent Slidev decks behind one Vite proxy; Slidev does not provide one
built-in multi-deck dev server with 12-hour process supervision.

For normal editing, use the landing-page link for the deck and let the side
editor auto-save. Do not block the `/__slidev/slides/<n>.json` route. If the
browser ever displays stale content after this repair, use a normal reload of
that deck page; the response is now explicitly non-cacheable. For a shareable
or production preview, build the decks and serve the generated output rather
than relying on Vite development servers.
