# Tasks

- [x] Inspect the current BIS Account Assets completion and Marketplace inventory event boundaries; identify the smallest public freshness signal that does not expose private SDK data.
- [x] Update the Marketplace Player Wallet inventory coordinator integration to invalidate or bypass only the active Player Wallet cache after a fresh Account Assets read or explicit Player Wallet refresh.
- [x] Preserve independent Game Wallet cache and loading/error state while sequencing stale Player Wallet requests safely.
- [x] Add coordinator tests covering cached-empty then fresh-positive Player Wallet results, role/network isolation, superseded reads, and unavailable-versus-empty states.
- [x] Add a Marketplace regression fixture for the exact Account → Assets → close → Player Wallet flow, including two positive holdings.
- [x] Verify the three-second loading behavior and selected-wallet prompt behavior with both wallet reads pending or one wallet unavailable.
- [x] Run Marketplace tests, relevant integration asset tests, typecheck, and the production Marketplace build.
