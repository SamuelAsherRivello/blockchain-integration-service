# Treasure contract recovery

This procedure covers separate, locally owned Player and Game Wallets on
Signet and Mutinynet. It does not migrate a hosted server wallet or convert
Bitcoin boarding funds. Both advertised treasure modes use real contracts.
Browser validation still has browser-enforced eligibility rather than
co-signer-enforced expiry. Full production qualification remains open in the
[acceptance report](treasure-production-acceptance.md).

## Export

1. Select the original network, Player Wallet and separate Game Wallet.
2. Open Account, Contracts, Portable recovery.
3. Enter a strong, unique recovery password of at least 16 characters.
4. Choose Export encrypted recovery. Keep the downloaded JSON file and its
   password in safe, separate places. Confirm the browser saved the file.

The export contains unresolved contracts for that selected pair, their
immutable scripts and terms, private preimages and available signed operation
journals. It also retains session-attempt history so an old Start is not funded
again. Completed contract bodies are omitted; their session attempts become
non-creating history entries. Wallet recovery phrases and private signing keys
are not included. Keep each wallet's normal recovery separately.

This is a snapshot, not automatic cloud backup. Export again after further
transactions, especially after an operation becomes uncertain. A file exported
before submission cannot contain the later signed request. Never delete the
original browser data merely because a download button was clicked.

Encryption uses Web Crypto AES-256-GCM with a fresh 16-byte salt and 12-byte IV,
and PBKDF2-SHA256 with 600,000 iterations. Format, network and algorithm settings
are authenticated. Unsupported algorithms, changed parameters, wrong passwords
and oversized files fail closed. The file limit is 8 MB, with at most 100
contract records and 1,000 session attempts. Password processing happens only
on explicit export/import, not on Start or chest opening.

## Restore on another browser or device

1. Close the old client. Browser locks do not coordinate independent devices.
2. Restore both original wallets separately, then select their original network.
3. Open Account, Contracts, Portable recovery. Select the encrypted file, enter
   its password and choose Import encrypted recovery.
4. Open the imported Contract Details and refresh its status.

Import validates the selected wallet keys and recompiles the original script.
It commits an additive encrypted journal and reservations without submitting a
transaction. Imported funding is initially unverified and spending is disabled.
An exact fresh unspent output can restore eligibility. An expired offer can
then refund through the existing recovery flow. Unknown signed work resumes
only its original request or finalization, not a replacement payment.

Wrong network, wallet keys, script, amount or destination prevents import or
reconciliation. A backup cannot overwrite a newer local operation. Keep both
files if a conflict is reported and inspect the existing local contract first.
Do not edit JSON or clear storage to bypass the conflict.

## Uncertainty and competing devices

A timeout is not a failed transaction. Retain the file, password and original
browser journal. Use Contract Details refresh to inspect the exact original
transaction. Do not start another payment to compensate for a missing toast.

BIS traces a different device's spend from the original contract through its
checkpoint to the exact bound payout. It rejects unrelated same-value payments
and substituted outputs. A verified competing result resolves the original
funds while retaining the superseded private operation bytes for audit.
Missing or unrecognized evidence keeps the reservation. There is no distributed
lock or browser-independent refund worker.

Reset refuses to erase unresolved recovery. Logout retains contract recovery
and applies the existing pending-operation safeguards. Corrupt encrypted data
cannot be treated as an empty wallet. Older finalization journals can reconstruct
their original transaction from fully signed checkpoints and fresh input facts;
recovery does not invent a new signature. If required material or network
evidence is missing, preserve it and seek operator-assisted investigation.

These checks confirm Arkade contract outcomes, not Bitcoin final settlement,
batch renewal or an economical unilateral exit for a 1,000-sat output.

## Batch expiry and unilateral exit limits

The treasure offer deadline and the underlying Arkade batch expiry are separate.
Refund eligibility after the offer deadline does not renew the batch or prove
that funds are available on Bitcoin. The pinned SDK 0.4.79 README documents
renewing virtual outputs before batch expiry to preserve unilateral control.
Its default wallet settlement manager is not evidence that BIS renews every
custom treasure contract; the persistent BIS app wallet session explicitly uses
`settlementConfig: false`. No worker is promised while every client is closed.

The same SDK documentation says an exit can need multiple transactions and
confirmations, CSV maturity and additional onchain funds for fees. A 1,000-sat
treasure output therefore has no guaranteed economical unilateral exit. Its
pre-signed exit packages handle BTC value only, can skip paths requiring another
party and may contain condition witnesses even when no private key is included.
Treat signed exit/recovery packages as confidential. Do not publish them as
public contract descriptors or ordinary logs.

This is a disclosure of current limits, not verification of a treasure-specific
exit package or a new renewal/exit operation. The source-hashed review and
remaining deployed-game/consent gates are in the
[T010 hardening handoff](../../openspec/programs/bis-server-treasure-release/treasure-t010-hardening-2026-10-26.md).
