# Spec Delta

## Purpose

Publish the Slidev presentation catalog independently from BIS while preserving usable public links and an authoring checkout that can be reproduced from its own repository.

## ADDED Requirements

### Requirement: Presentations have an independent public source
The complete active Slidev source and its authoring dependencies SHALL be available in the public `SamuelAsherRivello/blockchain-presentations` repository. A fresh checkout SHALL build and run the declared presentations without a sibling BIS checkout.

#### Scenario: Maintainer clones only the presentations repository
- **WHEN** a maintainer clones `blockchain-presentations` and follows its documented setup and build commands
- **THEN** the declared decks, shared theme, launcher, and required local assets are available and build without reading files from BIS

### Requirement: Presentations have their own public site
The presentations repository SHALL publish its landing page and declared public decks at `https://samuelasherrivello.github.io/blockchain-presentations/`. Its README SHALL link to that landing page. Landing links and direct deck routes SHALL load their intended slide and assets.

#### Scenario: Visitor opens the new landing page
- **WHEN** a visitor opens the presentations Pages root after deployment
- **THEN** the landing page lists the declared public decks and each link opens its intended deck

#### Scenario: Visitor opens a direct slide link
- **WHEN** a visitor opens or refreshes a published deck slide URL
- **THEN** that slide loads with its theme, images, and navigation available

### Requirement: Repository documentation links to presentation source
The BIS and Stealth & Steel game READMEs SHALL link to the main page of the public `blockchain-presentations` GitHub repository. The game's runtime GitHub buttons SHALL retain their existing destinations.

#### Scenario: Reader follows a source link
- **WHEN** a reader selects the presentations link in either repository README
- **THEN** the new presentations GitHub repository opens on its main page

#### Scenario: Player uses a game GitHub button
- **WHEN** a player selects an existing GitHub button in the game's Developer settings
- **THEN** that button opens the same repository it opened before the migration

### Requirement: Existing BIS presentation links redirect
BIS SHALL redirect its former `/blockchain-integration-service/slidev/` landing route and previously published deck and slide routes to the corresponding presentations Pages routes, preserving the selected deck and slide position. Its Admin and Marketplace routes SHALL remain available.

#### Scenario: Visitor follows an old landing link
- **WHEN** a visitor opens the former BIS Slidev landing URL
- **THEN** the browser reaches the new presentations landing page

#### Scenario: Visitor follows an old slide link
- **WHEN** a visitor opens a previously published BIS Slidev deck or slide URL, including a hash-based slide link
- **THEN** the browser reaches the matching deck and slide on the new presentations site

#### Scenario: Visitor opens either BIS demo
- **WHEN** a visitor opens the BIS Admin or Marketplace published URL after the extraction
- **THEN** the corresponding application and its required assets still load

### Requirement: Sibling checkout is clean
The new repository SHALL have a local checkout in a sibling `blockchain-presentations` directory with its migrated work committed and synchronized to its public remote.

#### Scenario: Maintainer inspects the completed checkout
- **WHEN** the migration is reported complete
- **THEN** the sibling directory exists, `origin` identifies the new public repository, the branch tracks its remote, and the working tree has no local changes
