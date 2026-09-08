# F3. Board Game Wallet

User-requested extension: Admin offers Board and Check Status for the selected game wallet. Board reviews the maximum eligible Bitcoin amount, fee, and net Arkade receipt before Confirm Board signs. It reuses the existing boarding adapter and wallet mutation lock. Pending operations block another boarding submission; checks reconcile recorded operations without polling or resubmission.

Game boarding ownership is recorded before submission so player logout preserves these recovery journals. No credentials enter the console. Existing push balance updates remain enabled.

Verification: TypeScript and both production builds passed. Twelve focused game wallet, event subscription, and logout tests passed, including identity routing, rejection of another wallet's quote, and retention of game boarding records through player cleanup. Browser inspection at http://127.0.0.1:5184/ confirmed F3 and disabled controls before import.

No real Signet boarding transaction was submitted during verification. Live fee review, signing, and confirmed receipt remain unverified. Keep the signing tab open; Check Status verifies receipt but does not resume interrupted signing.
