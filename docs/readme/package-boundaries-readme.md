# Package boundaries

Blockchain Integration Service uses npm workspaces to keep reusable game integration distinct from the applications and experiments that exercise it.

`@bis/integration` is the reusable browser-game library. It owns the public host contract, account and wallet workflows, browser persistence, production Account UI, core state, and Arkade adapter composition. Consumers start from its public exports and stylesheet; they do not import private library source files.

`@bis/integration-admin` is the development harness. It composes the public integration API into Admin controls, a console, a portrait preview, and documentation views. It does not define reusable wallet behavior. `@bis/marketplace` is another public-API consumer that owns catalog and equipment presentation while relying on the integration package for wallet and transaction rules.

`@spike/prototype-onboarding` is intentionally different. It is an independent Signet experiment that uses the Arkade SDK directly to observe onboarding and recovery behavior. Its accounts, browser persistence, and timing records are separate from Admin and Marketplace data. It is not a production game-host API and does not establish the integration package’s contract.

The allowed direction is therefore consumer or experiment → public integration API, except for the documented standalone prototype. The integration package must not depend on Admin, Marketplace, or the prototype. A game host retains gameplay scenes, effects, and consequences; BIS reports confirmed protocol-neutral outcomes through its public contract.

See the package READMEs for entry points and package-specific verification, and the [verification scope](verification-scope-readme.md) for the repository command boundary.

[Back to the main README](../../README.md)
