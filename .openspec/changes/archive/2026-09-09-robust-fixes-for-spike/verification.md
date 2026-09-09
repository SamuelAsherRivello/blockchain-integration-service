# Archive verification — 2026-09-09

## Disposition

The user accepted the spike when its four funded runs succeeded, then requested three additional monitored runs. All seven original accounts reached the unchanged Step 6 predicate: exact attributable spendable Arkade targets, exact Bitcoin returns, original input spends and both confirmed commitments. The subsequent request to sync and archive closes this accepted spike outcome. Eleven of 26 implementation tasks are complete; 15 remain unchecked. This archive is not certification that every requirement in the resilience specification is implemented.

## Delivered fixes and verification

Delivered work includes durable captured-input checkpoints, short operation locks, automatic same-account recovery, provider deadlines and retry floors, stale-result guards, exact receipt reconciliation, and guarded diagnostics. Live debugging reproduced an earlier-batch failure interrupting a replacement intent; the wrapper now admits failures only for the batch selecting that intent. Additional fault testing reproduced unrelated batch traffic indefinitely renewing the timeout; only matching batch progress now renews it. Actual selected-batch failures still recover after SDK cleanup.

The regression tests failed before their fixes and passed afterward. The final standalone suite passed **89 tests**; both standalone and integration-demo production builds passed. No runtime changes were made as part of this archive operation.

## Live evidence

| Cohort | Verified outcomes | Total durations | Step 5 | Step 6 | Confirming block |
| --- | --- | --- | --- | --- | --- |
| Four original accepted runs | 4/4 | 33m 21s, 32m 58s, 33m 1s, 33m 3s | 26m 58s each | 1m 47s each | 321340 |
| Three additional runs | 3/3 | 12m 30s, 12m 32s, 12m 28s | 2m 25s each | 3m 42s each | 321342 |

Four-run Arkade/Bitcoin allocations: 24,999/25,000; 24,996/24,996; 24,996/24,997; 24,611/24,611 sats. Public [boarding](https://mempool.signet.arkade.sh/tx/d764e354091ea7daf87882707671cd653c378be15602ab20f004f83737867b59) and [return](https://mempool.signet.arkade.sh/tx/920099ff55b286aca77896c555031d43872247267e371d90887fc519ee220b39) transactions were independently verified against the original deposits and exact outputs.

Three-run Arkade/Bitcoin allocations: 22,621/22,621; 16,666/16,667; 5,555/5,556 sats. Public [boarding](https://mempool.signet.arkade.sh/tx/798edcc32a55d67b53fb732c8b039d879bebdd12c1571fa8f9abb48266877c2d) and [return](https://mempool.signet.arkade.sh/tx/385eea1136054cfbcbc6bef1bade0fb5f75601880e69ece678190cc9cded548b) were independently verified. No account reset or extra funding was needed.

The first cohort includes seven failed recovery cycles and live investigation before the batch-correlation fix. The second includes an agent-caused Vite reload after funding confirmed between the pre-edit check and source edit; all three recovered automatically. Neither cohort is described as uninterrupted. Accounts within each cohort shared batches; these are not seven independent network-condition samples. The observed timing improvement is not a controlled benchmark or a duration guarantee. Detailed tracked evidence is preserved in `BIS/documentation/User Story Diagrams.md`, H1 post-mortems; additional public-only diagnostics remain under ignored `output/reports/robust-fixes-for-spike/`.

## Remaining scope

Unchecked tasks 1.1, 2.1, 2.3, 2.4, 3.4, 3.5, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5 and 6.1 retain their original acceptance wording. Several have partial implementations or tests, but full boundary/lifecycle coverage, detailed timing instrumentation and controlled latency benchmarks were not completed. The reports deliberately retain these gaps. Future work must review those tasks against the implementation instead of assuming archival completed them.
