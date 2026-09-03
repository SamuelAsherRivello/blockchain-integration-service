# Core

Owns immutable public account/view state, hydration, creation/activation orchestration, safe events, cancellation, and reset. Origin-scoped AES-GCM storage commits identity only on Continue. Recovery material is available only to the private production UI. Test dependency seams are not package exports. Reset is distinct from disposal: reset clears BIS-owned identity; disposal preserves completed identity.

A6 owns backup acknowledgement, generation-guarded logout, ambiguous-result reconciliation and retry. Successful logout preserves Account presentation and emits a non-secret `accountDisconnected` transition after confirmed absence. Storage notifications reconcile other contexts, and stale confirmations cannot clear replacement accounts. Admin reset retains its separate empty-presentation behavior. Real database deletion verification remains manual; core tests use storage doubles.
