# Core

Owns immutable public account/view state, hydration, creation/activation orchestration, safe events, cancellation, and reset. Origin-scoped AES-GCM storage commits identity only on Continue. Recovery material is available only to the private production UI. Test dependency seams are not package exports. Reset is distinct from disposal: reset clears BIS-owned identity; disposal preserves completed identity.
