# Spec Delta

## ADDED Requirements

### Requirement: Feedback-directed source visual fidelity
The Blockchain For Game deck SHALL render the authorized source visuals for slides 3, 4, 5, and 30 at an upscaled resolution suitable for their displayed bounds. Slide 5 SHALL contain both required visuals, and slide 30 SHALL place its visual in the left pane of a cataloged image-left composition.

#### Scenario: Source visuals are rendered in their required compositions
- **WHEN** a reviewer opens slides 3, 4, 5, or 30 in the local Blockchain For Game route
- **THEN** each slide shows its authorized high-resolution source visual without distortion or clipping, slide 5 shows both visuals, and slide 30 shows its visual left of its text

### Requirement: Feedback-directed content and diagram geometry
The deck SHALL render slides 14 and 15 using the shared content treatment, with five top-level bullets on slide 14 and two subordinate bullets per top-level item on slide 15. Slides 10 through 12 SHALL render diagrams at 130 percent of their prior scale and 300 pixels lower while retaining all diagram content within the visible slide canvas.

#### Scenario: Reviewer inspects revised content and diagrams
- **WHEN** a reviewer opens slides 10 through 15 in the local Blockchain For Game route
- **THEN** the three diagrams are larger and lower without clipping, slide 14 presents five top-level bullets in one text field, and slide 15 presents those same bullets with two subordinate bullets for each

### Requirement: Whole-deck rendered visual review
The presentation workflow SHALL produce a Playwright-rendered inspection for every Blockchain For Game slide and retain the review artifacts under the repository-root `output/` directory. The review SHALL examine image bounds, diagram bounds, text overflow, and slide composition before the feedback change is accepted.

#### Scenario: Full deck review is executed
- **WHEN** the visual-feedback change is verified
- **THEN** every deck slide has a current rendered-review result and the review reports no unresolved image-size, diagram-size, clipping, or overflow defect
