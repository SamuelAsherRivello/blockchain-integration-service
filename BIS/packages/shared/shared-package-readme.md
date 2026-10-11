# Shared configuration

[Back to the main README](../../../README.md)

`@bis/shared` owns the canonical local environment template and the Node-only loader used by BIS development servers and agent wallet tooling. It gives developer-supplied secrets one configuration home without adding a browser signer, a hosted service, or a new game-facing API. It has no browser application; the shared Vite launcher renders this README at `/shared/`.

## Configure locally

Copy or rename [.env.local.template](.env.local.template) to `.env.local` in this package directory: `BIS/packages/shared/.env.local`. Populate that file privately in your editor. The tracked template contains blank values, comments, and optional non-secret defaults; it never contains usable recovery material. Do not paste the populated file into chat, attach it to an issue, or include it in a screenshot or diagnostic dump.

The two `FAUCET_*_MNEMONIC` entries configure the separate Signet and Mutinynet faucet signers. The four `BIS_TEST_ACCOUNT_*_MNEMONIC` entries supply disposable test identities to the agent runner. Keep faucet signers distinct from Player/Game identities. Each test identity can be restored on either supported network, but its funds, history, and readiness are network-specific. Slot numbers do not permanently assign roles; the runner selects two distinct registered identities for each Player/Game pair.

Optional faucet settings retain existing defaults: `FAUCET_PORT`, per-network maximum sats, and `FAUCET_STATE_DIR`. These are server configuration, not browser variables. Never rename a secret to begin with `VITE_`. The loader explicitly selects known keys and does not export the rest of the file to its caller.

## Consumers and precedence

The faucet server loads only its own signer and configuration keys. Direct server startup, standalone faucet Vite startup, the repository’s shared launcher, and the funding helper all reach that same server-side loader. Neither Admin nor Marketplace nor the game receives the environment file. Onboarding uses a selected test identity through its ordinary private restoration flow; it has no separate environment signer.

An explicitly set process environment value takes precedence over the local file. When the shared `.env.local` exists, it is the only file source, even when an entry is blank. The old `prototype-faucet/.env.local` is a compatibility fallback only while the shared file is absent. This avoids silently combining identities from two files. Existing credentials are not printed, moved, or deleted during setup. Once the shared configuration works, the user may retire the legacy file while retaining any necessary private backup.

To privately register populated test slots, run from the repository root:

```text
npm run test-wallets -- init
npm run test-wallets -- import --shared
npm run test-wallets -- status
```

Import validates compatible recovery phrases and public identities, rejects duplicate signers or label replacement, and saves each completed registration in the encrypted Windows-user vault. Public status never returns recovery input. Empty slots are skipped; an entirely unconfigured source reports unavailable. Repeating import retains existing identities and journals. No import funds a wallet or triggers onboarding.

## Security and runtime storage

Git, AI indexing, and triage exclude the populated `.env.local`; the placeholder template stays visible. These exclusions prevent accidental collection, not unauthorized filesystem access. Protect the populated file using your operating-system account permissions. The shared Vite middleware rejects populated environment paths, including raw-import requests, before package-route rewriting. Published assets must contain neither the populated file nor its values.

The environment file is the canonical developer-supplied input, not a replacement for runtime persistence. Generated agent identities remain in the encrypted external vault. Application journals and dedicated browser profiles retain their existing recovery responsibilities. This package never exports browser secrets back into `.env.local`, copies browser storage, or claims production-grade custody.

## Development and verification

The implementation entry is `src/server/environment.mjs`, exported only under a Node condition. It has no third-party dependencies. Run `npm run test --workspace @bis/shared` for precedence, key isolation, missing configuration, legacy fallback, and sanitized-error tests. Repository tests additionally check private serving and test-account import. These checks do not prove funding or onboarding; use the [agent wallet guide](../../documentation/agent-test-wallets.md) for that workflow and its live-verification limits.
