# Spec Delta

## Purpose

Provide a reviewable visual showcase of selected blockchain games with playable discovery links and consistent game-media presentation.

## ADDED Requirements

### Requirement: Game showcase product slide
The documentation system SHALL provide a reusable game-product slide with a title and subtitle above two equal, side-by-side columns separated by a small gap. Each column SHALL have a FocusedLink label above a 16:9 visual pane: Website for the official-game screenshot and YouTube for the official-video thumbnail.

#### Scenario: Author uses the product composition
- **WHEN** an author creates a game showcase slide
- **THEN** the rendered slide shows its title and subtitle above equally sized columns with a Website label and official screenshot on the left, and a YouTube label and official-video thumbnail on the right

### Requirement: Games Subdeck presents selected examples
The documentation system SHALL expose a Games Subdeck with one product slide for Bitmap.Game, SHRAPNEL, and Big Time. Each slide SHALL present an official gameplay image on the left and the HD thumbnail of its selected official YouTube video on the right.

#### Scenario: Reviewer opens the Games Subdeck
- **WHEN** a reviewer navigates to the Games Subdeck preview route
- **THEN** the reviewer can inspect one correctly labeled product slide for each selected game

### Requirement: Game destinations open safely
Each product slide's Website FocusedLink and screenshot SHALL lead to that game's official website, and its YouTube FocusedLink and thumbnail SHALL lead to the selected official video. Selecting either SHALL open a new browser tab. Website destinations SHALL preserve a direct official-site destination when the framed presentation cannot be displayed.

#### Scenario: Official page permits framing
- **WHEN** a reviewer selects a game's Website FocusedLink and the official page permits framing
- **THEN** the new tab shows the framed link experience for that official page

#### Scenario: Official page prevents framing
- **WHEN** a reviewer selects a game's Website FocusedLink and the official page prevents framing
- **THEN** the new tab provides a direct link that opens the official page without a frame

#### Scenario: Reviewer opens the official video
- **WHEN** a reviewer selects a game's YouTube FocusedLink or thumbnail
- **THEN** the selected official YouTube video opens in a new browser tab
