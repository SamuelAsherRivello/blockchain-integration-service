# Robustness boundary matrix

This matrix assigns the intended coverage; it is not a claim that every case is finished. Automated faults are isolated from the live wallets. Implemented families include queued-lock deadlocks, hung observations, durable preparation, transient settlement recovery, lost acknowledgements, stale account results, transport timeouts, retry floors and storage quarantine. Bootstrap import failures, the complete lifecycle matrix and latency benchmarks remain open in the proposal tasks.

| Boundary | Deadline / fallback | Test family |
| --- | --- | --- |
| Module load, capabilities, window lease | Bootstrap error shell; 10s queued-lock deadline; same scope retry | bootstrap / window-state |
| IndexedDB open, read, write, restart transaction | 10s; abort and reconcile uncertain commit; preserve identity | vault |
| Identity decrypt/encrypt/create | 30s local work; quarantine late result; never repeat an ambiguous create | vault / lifecycle |
| Wallet creation, getInfo, address, disposal | 45s workflow / 30s HTTP; same account reconnect; quarantine abandoned instance | lifecycle / coordinator |
| Faucet opening / clipboard | Explicit user action; direct link or manual copy; never auto-fund | browser / lifecycle |
| Coins, tip, balances, transaction history, VTXOs | 45s call / 30s HTTP; independent observation with retry and cooldown | coordinator / transport / lifecycle |
| Input capture and preparation | Durable prepared phase; short lock; no recapture; bounded unknown rechecks | lifecycle |
| Register/confirm/nonces/signatures/forfeits/cleanup HTTP | 30s request/body; no transport replay; SDK cleanup then reconcile | transport / lifecycle |
| Settlement stream and callback | 5m inactivity; actual stream abort; critical persistence failure marks uncertainty | lifecycle |
| Hung signer/cleanup | Progress diagnosis; keep signing lease, independent reads; no replacement signer | lifecycle / coordinator |
| Boarding / return acknowledgement | Frozen inputs and exact attributable receipts; no completed-leg replay | lifecycle / model |
| Final confirmation / spendability | Healthy 5s observation; wait-external, never manufacture success | lifecycle / model |
| Timing and preferences | Optional 10s lock/write; bounded diagnostic fallback | timing / lifecycle |
| Rendering and global callbacks | Guard each boundary; step-local status; no recursive error loop | callback-errors / browser |
| Reload, restart, stale attempt, n windows | Account/attempt/revision fences; queued locks; disposed watchers | lifecycle / window-state |

Baseline reproduced 2026-09-09: startup does not schedule reconnect; a hung coin read retains the operation lock; preparation failure can recapture later deposits. See ignored `output/logs/robust-fixes-for-spike/red-tests.log`. Live acceptance is separate in the change tasks.
