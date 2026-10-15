# Operation layer

This layer is reserved for durable client operation journals, pending/recovery workflows, quote fingerprints, reservations, submission status, and reconciliation orchestration. Keep UI prompts in `ui-layer-react` and direct SDK calls in `wallet-layer-arkade`.

Games use named `IBis` workflow commands and operation projections, not journals or recovery controllers. Bind the originating `BisGameSession` before asynchronous submission; report the financial outcome independently of the host's effect receipt. Local reset invalidates the facade's transient workflows and late local writes, but does not cancel a submitted remote operation. Normal disposal retains existing contract recovery according to its preservation option.
