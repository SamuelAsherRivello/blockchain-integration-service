# Core

Owns immutable public account/view state, hydration, creation/restoration orchestration, safe events, cancellation, and reset. Origin-scoped AES-GCM storage commits a created identity on Continue or a restored identity after verified Signet connection. Recovery material is available only to the private production UI. Test dependency seams are not package exports. Reset is distinct from disposal: reset clears BIS-owned identity; disposal preserves completed identity.

A3 opens with `openRestoreAccount()` and accepts recovery submission through private controls. Local word/checksum validation gates network work. Restoration reuses generation-checked saving, reconciles uncertain commits, and invalidates stale work on navigation or account changes. No phrase enters public state or events.

A6 owns backup acknowledgement, generation-guarded logout, ambiguous-result reconciliation and retry. Successful logout preserves Account presentation and emits a non-secret `accountDisconnected` transition after confirmed absence. Storage notifications reconcile other contexts, and stale confirmations cannot clear replacement accounts. Admin reset retains its separate empty-presentation behavior. Real database deletion verification remains manual; core tests use storage doubles.
