# Tasks

## 1. Authoritative source visual preparation

- [x] 1.1 Capture the authorized Google source visuals for slides 3, 4, 5, and 30; create display-ready upscaled assets with provenance recorded in `content-source-manifest.json`, and verify every referenced asset exists and has dimensions sufficient for its rendered bounds.
- [x] 1.2 Add source-visual treatment assertions to the layout contract and verify `npm run verify:layout-contract` rejects a missing target visual or a slide-5 composition without both images.

## 2. Feedback-directed deck composition

- [x] 2.1 Recompose slides 3–5 with the upscaled source visuals, retaining both images on slide 5; verify the canonical route renders every image without distortion, clipping, or overlap.
- [x] 2.2 Recompose slides 10–12 in a staged diagram region at 130 percent scale and a 300-pixel lower position; verify all nodes, labels, and connections stay inside the 1280-by-720 visible canvas.
- [x] 2.3 Recompose slides 14–15 using the content treatment with five top-level bullets on slide 14 and two subordinate bullets under each on slide 15; verify the browser-visible text hierarchy and absence of overflow.
- [x] 2.4 Switch slide 30 to the cataloged image-left composition with its upscaled source visual left and explanatory text right; verify layout contract mapping and browser-visible pane placement.

## 3. Full-deck visual review and acceptance

- [x] 3.1 Extend the Playwright rendered-review workflow to capture all deck slides under `output/screenshots/update-slide-deck-results-2/` and fail on missing target visuals, viewport overflow, or out-of-bounds visible images and diagrams; verify the script visits every manifest-backed slide.
- [x] 3.2 Review every produced Playwright screenshot for image sizing, diagram sizing, text fit, and overall composition; correct each observed defect and rerun the review until no unresolved visual issue remains.
- [x] 3.3 Run `npm run build:blockchain-for-game`, `npm run verify:layout-contract`, `npm run verify:layout-contract:self-test`, and the full rendered-review command; verify all commands pass and the local `/slidev/blockchain-for-game/1` route starts without console errors.
