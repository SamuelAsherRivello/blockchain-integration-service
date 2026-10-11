# Prototype Sandbox

[Back to the main README](../../../README.md)

`@spike/prototype-sandbox` is a development-only collection of ten empty demo shells. Each demo has a stable URL and shares the compact title bar used by the Prototype Faucet, including the Signet and Mutinynet network selector. The package is a staging area for future Arkade experiments; it is not part of the reusable BIS integration API.

## Demo entry points

Open the shared development server and use `/prototype-interactive-docs/demo-1/` through `/prototype-interactive-docs/demo-11/`. The Navigation section lists the demos in rows. The current demo is disabled, while the other items are links to their dedicated entry points.

The initial pages intentionally contain no Faucet form, wallet action, network request, or placeholder behavior. The network selector keeps the existing Prototype Faucet presentation and confirmation behavior so future demos can add network-specific content without changing the shell contract.

## Development

Run `npm run dev` from the repository root to use the shared Vite server, then open any Sandbox demo route. For isolated package development, run `npm run dev --workspace @spike/prototype-sandbox`.

## Verification

Run `npm run test --workspace @spike/prototype-sandbox` for deterministic route and navigation checks. Run `npm run build --workspace @spike/prototype-sandbox` to verify the standalone package build. Browser verification should confirm direct loading of all ten routes, the shared title and selector, the disabled active item, and navigation to another demo.

This prototype does not custody funds, call the Faucet API, or perform Arkade operations.

## Shell contract

The package deliberately owns presentation only. The title bar identifies the
surface as `BIS - Prototype Faucet` so it remains visually compatible with the
Faucet prototype that inspired this shell. The selector contains the same two
network choices and starts on Mutinynet. Changing it uses the existing
confirmation message and updates the visible selection, but it does not make a
request or reset any wallet data because these pages have no network-backed
workflow.

Navigation is a single horizontal row below the title bar. It always contains
exactly ten labels, from Demo 1 to Demo 10. The current page is represented by
a disabled button with `aria-current="page"`; all other labels are regular
links. This makes the current location apparent to keyboard users and keeps
each future experiment addressable without introducing client-side routing
state that could drift from the browser URL.

## Package boundaries

Prototype Sandbox is intentionally separate from `@bis/integration`, Admin,
Marketplace, and the Faucet server. It may reuse the prototype stylesheet and
network definitions, but it does not export product components, read account
storage, or import signing and wallet services. Future demos should keep their
own behavior inside this package and should add explicit requirements before
they introduce network calls, persistence, or user-facing product flows.

Each route has a small HTML document so the shared development server can serve
it as a normal package entry. Those documents all boot the same React shell,
which means changes to the title bar or Navigation are made once. The active
demo is derived from the URL path; a missing or unsupported demo number falls
back to Demo 1, while the ten documented paths remain the supported public
surface for local development.

## Adding a future demo

Keep new UI behind the shared shell, preserve the title bar and Navigation
contract, and keep secrets out of browser code, logs, and committed
configuration. If a demo needs Arkade operations, define a separate change
covering validation, pending states, failures, and the appropriate server
boundary before implementing it. Do not turn an empty Sandbox page into a
funding or custody surface without an explicit design.

If a direct URL returns a missing page, confirm that the shared server was
started from the repository root with `npm run dev` and that the URL includes
its trailing slash. The shared server is the authoritative check because it
exercises the same package routing used by the other BIS prototypes.
