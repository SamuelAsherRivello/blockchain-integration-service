# Arkade wallet layer

This layer owns direct Arkade SDK usage, Signet wallet inspection, identity reconstruction, network policy checks, and SDK-facing transaction or asset operations. Do not expose Arkade SDK types through public state or game-facing APIs.

Player and Game Wallet adapters share the same fresh, bounded read contract: provider/network validation, balance and address validation, cancellation, and retry are common mechanics. Role-specific controllers still own storage, selection, authorization, and operation policy. A failed live Game Wallet observation is not itself proof that a previously validated balance was invalid; BIS performs bounded recovery reads before publishing unavailable state.
