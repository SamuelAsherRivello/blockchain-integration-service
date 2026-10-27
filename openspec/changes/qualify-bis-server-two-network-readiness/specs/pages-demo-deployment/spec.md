# Spec Delta

## ADDED Requirements

### Requirement: Two-network signer release gate
The BIS and Stealth & Steel Pages releases SHALL integrate the Vercel signer for Signet and Mutinynet only after each network independently passes hosted identity, policy, signing, and consumer acceptance. Existing published application routes and immutable assets SHALL remain usable. Completion SHALL require exact deployment success and real game-wallet signing acceptance on both networks, not only identity probes.

#### Scenario: Both networks are accepted
- **WHEN** the two-network release is declared complete
- **THEN** published Admin, Marketplace, and Stealth & Steel consumers use the compatible signer on both Signet and Mutinynet
- **AND** each network's signing evidence is independently recorded

#### Scenario: One network is unavailable
- **WHEN** one hosted network is missing or incompatible
- **THEN** consumers report that network as unavailable and preserve explicit manual fallback
- **AND** they do not substitute the other network's signer
