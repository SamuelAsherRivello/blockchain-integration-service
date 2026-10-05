# Spec Delta

## Purpose

Preserve the approved Mondrian catalog details as observable, renderable requirements while the Slidev theme and layouts evolve.

## ADDED Requirements

### Requirement: Subsection and catalog sequence are preserved
The Mondrian catalog SHALL render the subsection title in a field that is two lines tall and bottom-aligned. The former template slide nine SHALL remain absent from the catalog sequence.

#### Scenario: Reviewer opens the subsection example
- **WHEN** the Mondrian template catalog renders its subsection example
- **THEN** its title field supports two lines and is bottom-aligned

#### Scenario: Reviewer inspects the catalog sequence
- **WHEN** the Mondrian template catalog is rendered
- **THEN** it does not contain the removed former slide-nine composition

### Requirement: Clickable images retain clean presentation
The Mondrian catalog SHALL render image-only links without an underline or dotted bottom rule, while retaining a visible keyboard-focus treatment.

#### Scenario: Reviewer tabs to a clickable image
- **WHEN** keyboard focus reaches an image-only link
- **THEN** the image has a visible focus indicator and no underline or dotted bottom rule

### Requirement: Sierra logo presentation is exact
The Sierra logo in the Mondrian Game XP composition SHALL have a white border of exactly two CSS pixels and no additional border or shadow that changes that measured border.

#### Scenario: Reviewer inspects the Sierra logo
- **WHEN** the Game XP composition is rendered
- **THEN** the Sierra logo has exactly a two-pixel white border

### Requirement: Game XP composition preserves approved geometry and timing
The Game XP composition SHALL align its title and caption with the corresponding Blockchain XP composition, left-justify upper-left text, right-justify upper-right text, and stage its copy before logo-image fades at one-hundred-millisecond intervals.

#### Scenario: Reviewer observes Game XP animation
- **WHEN** the Game XP composition starts
- **THEN** copy appears before the logo images and the images begin their fades in one-hundred-millisecond intervals

#### Scenario: Reviewer compares XP text fields
- **WHEN** the Blockchain XP and Game XP compositions are viewed
- **THEN** their corresponding title and caption fields occupy matching positions with the required left/right justification
