import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const { SKILL_DIR, TMP_DIR, WORKSPACE_DIR, FINAL_PPTX } = process.env;
for (const [name, value] of Object.entries({ SKILL_DIR, TMP_DIR, WORKSPACE_DIR, FINAL_PPTX })) {
  if (!path.isAbsolute(value ?? "")) throw new Error(`${name} must be an absolute path`);
}

const {
  resolvePresentationFont,
  finalizePresentation,
} = await import(pathToFileURL(path.join(SKILL_DIR, "container_tools", "artifact_tool_utils.mjs")).href);

const font = resolvePresentationFont();
const W = 1280;
const H = 720;
const bgPath = path.join(WORKSPACE_DIR, "BIS", "marketing", "rmc-template", "assets", "rmc-background-v1.png");
const bgBytes = new Uint8Array(await fs.readFile(bgPath));
const rocketBytes = new Uint8Array(await fs.readFile(path.join(WORKSPACE_DIR, "BIS", "marketing", "rmc-template", "assets", "rmc-rocket-v1.png")));
const orbitAssetBytes = new Uint8Array(await fs.readFile(path.join(WORKSPACE_DIR, "BIS", "marketing", "rmc-template", "assets", "rmc-orbit-asset-v1.png")));
const portalBytes = new Uint8Array(await fs.readFile(path.join(WORKSPACE_DIR, "BIS", "marketing", "rmc-template", "assets", "rmc-portal-v1.png")));
const iconNames = ["nft", "blockchain", "games", "decentralized", "metaverse", "social-networks", "immutable", "transparent", "internet", "wifi", "user", "multiplayer", "token", "trophy"];
const iconBytes = Object.fromEntries(await Promise.all(iconNames.map(async (name) => [
  name,
  new Uint8Array(await fs.readFile(path.join(WORKSPACE_DIR, "BIS", "marketing", "rmc-template", "assets", "icons", `${name}.png`))),
])));
await fs.mkdir(TMP_DIR, { recursive: true });

const C = {
  navy: "#071B38",
  ink: "#081A34",
  white: "#F4F8FF",
  muted: "#B4C7E4",
  cyan: "#5AD7FF",
  blue: "#287BFF",
  line: "#31517D",
  panel: "#102B50",
  panel2: "#0C2547",
};

const presentation = Presentation.create({ slideSize: { width: W, height: H } });

function text(slide, value, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position,
    fill: "none",
    line: { fill: "none", width: 0 },
  });
  shape.text = value;
  shape.text.style = {
    typeface: font,
    fontSize: 18,
    color: C.white,
    autoFit: "none",
    ...style,
  };
  return shape;
}

function box(slide, position, { fill = C.panel, line = C.line, radius = "rounded-xl" } = {}) {
  return slide.shapes.add({
    geometry: "roundRect",
    position,
    fill,
    line: { style: "solid", fill: line, width: 1 },
    borderRadius: radius,
  });
}

function base(role, index, { image = true } = {}) {
  const slide = presentation.slides.add();
  slide.background.fill = C.navy;
  if (image) {
    slide.images.add({
      blob: bgBytes,
      contentType: "image/png",
      alt: "Abstract RMC dark blue presentation background",
      fit: "cover",
      position: { left: 0, top: 0, width: W, height: H },
    });
  }
  text(slide, "RMC Template", { left: 64, top: 674, width: 170, height: 20 }, { fontSize: 12, color: C.muted });
  text(slide, role, { left: 245, top: 674, width: 600, height: 20 }, { fontSize: 12, color: C.muted });
  text(slide, String(index).padStart(2, "0"), { left: 1160, top: 674, width: 54, height: 20 }, { fontSize: 12, color: C.muted, alignment: "right" });
  return slide;
}

function title(slide, value, subtitle = null) {
  text(slide, value, { left: 76, top: 62, width: 880, height: 64 }, { fontSize: 38, bold: true, color: C.white });
  if (subtitle) text(slide, subtitle, { left: 78, top: 134, width: 820, height: 32 }, { fontSize: 18, color: C.muted });
}

function tag(slide, value, x, y, w = 160) {
  box(slide, { left: x, top: y, width: w, height: 30 }, { fill: C.ink, line: C.cyan, radius: "rounded-full" });
  text(slide, value, { left: x + 14, top: y + 6, width: w - 28, height: 18 }, { fontSize: 12, bold: true, color: C.cyan, alignment: "center" });
}

function art(slide, blob, alt, position) {
  return slide.images.add({
    blob,
    contentType: "image/png",
    alt,
    fit: "contain",
    position,
  });
}

// 01 — title
{
  const slide = base("Title slide", 1);
  tag(slide, "RMC Template", 78, 96, 170);
  text(slide, "A reusable\nslide system", { left: 76, top: 154, width: 600, height: 160 }, { fontSize: 58, bold: true, color: C.white });
  text(slide, "Dark blue. Quiet contrast. Abstract visual space.\nEditable in Google Slides.", { left: 80, top: 352, width: 470, height: 62 }, { fontSize: 22, color: C.muted });
  text(slide, "Built first for BIS", { left: 80, top: 596, width: 250, height: 24 }, { fontSize: 15, color: C.cyan, bold: true });
  art(slide, rocketBytes, "Replaceable blue rocket key art", { left: 716, top: 155, width: 440, height: 360 });
}

// 02 — section title
{
  const slide = base("Section title", 2);
  tag(slide, "01", 78, 126, 70);
  text(slide, "The next\nconversation", { left: 76, top: 190, width: 640, height: 150 }, { fontSize: 54, bold: true, color: C.white });
  text(slide, "Use this layout to introduce a new chapter without adding a second visual system.", { left: 80, top: 378, width: 540, height: 62 }, { fontSize: 21, color: C.muted });
  art(slide, portalBytes, "Replaceable blue portal key art", { left: 752, top: 164, width: 395, height: 390 });
}

// 03 — table of contents
{
  const slide = base("Table of contents", 3);
  title(slide, "Table of contents", "Five concise stops are enough for a clear narrative.");
  const items = [
    ["01", "Context", "What the audience needs to know first"],
    ["02", "System", "How the parts fit together"],
    ["03", "Experience", "What changes for people using it"],
    ["04", "Decision", "The choice and its tradeoffs"],
    ["05", "Next step", "The work that follows"],
  ];
  items.forEach(([n, h, d], i) => {
    const y = 192 + i * 82;
    text(slide, n, { left: 86, top: y + 12, width: 44, height: 24 }, { fontSize: 17, bold: true, color: C.cyan });
    text(slide, h, { left: 162, top: y + 4, width: 200, height: 30 }, { fontSize: 22, bold: true });
    text(slide, d, { left: 410, top: y + 8, width: 490, height: 28 }, { fontSize: 16, color: C.muted });
    slide.shapes.add({ geometry: "rect", position: { left: 82, top: y + 56, width: 820, height: 1 }, fill: C.line, line: { fill: "none", width: 0 } });
  });
}

// 04 — full-screen content
{
  const slide = base("Full-screen statement", 4);
  tag(slide, "Full-screen content", 78, 98, 210);
  text(slide, "One clear idea\ncan hold the room.", { left: 76, top: 194, width: 650, height: 160 }, { fontSize: 55, bold: true, color: C.white });
  text(slide, "Use this slide for a point of view, a decision, or a statement that needs space.", { left: 82, top: 400, width: 610, height: 58 }, { fontSize: 20, color: C.muted });
  slide.shapes.add({ geometry: "rect", position: { left: 82, top: 480, width: 150, height: 5 }, fill: C.cyan, line: { fill: "none", width: 0 } });
  art(slide, orbitAssetBytes, "Replaceable orbiting asset key art", { left: 760, top: 230, width: 380, height: 330 });
}

// 05 — left content, right visual
{
  const slide = base("Left content / right visual", 5);
  title(slide, "Content with a visual", "A written explanation on the left and an interchangeable visual on the right.");
  text(slide, "Headline that explains the point", { left: 78, top: 222, width: 480, height: 62 }, { fontSize: 30, bold: true });
  text(slide, "Use two or three short paragraphs or a compact list. Keep the audience focused on one point and let the visual do a different job.", { left: 80, top: 310, width: 430, height: 125 }, { fontSize: 18, color: C.muted });
  box(slide, { left: 660, top: 190, width: 470, height: 370 }, { fill: C.panel2, line: C.cyan, radius: "rounded-2xl" });
  text(slide, "Replace with visual", { left: 710, top: 326, width: 370, height: 32 }, { fontSize: 24, bold: true, color: C.white, alignment: "center" });
  text(slide, "Image, product capture, diagram, or illustration", { left: 705, top: 368, width: 380, height: 24 }, { fontSize: 15, color: C.muted, alignment: "center" });
}

// 06 — timeline
{
  const slide = base("Timeline / process", 6);
  title(slide, "A simple progression", "Four moments communicate a process without a dense process map.");
  const steps = [
    ["01", "Signal", "The trigger or user need"],
    ["02", "Route", "The system selects a path"],
    ["03", "Confirm", "The work becomes visible"],
    ["04", "Record", "The outcome remains available"],
  ];
  slide.shapes.add({ geometry: "rect", position: { left: 165, top: 382, width: 890, height: 3 }, fill: C.line, line: { fill: "none", width: 0 } });
  steps.forEach(([n, h, d], i) => {
    const x = 105 + i * 260;
    slide.shapes.add({ geometry: "ellipse", position: { left: x, top: 350, width: 66, height: 66 }, fill: C.blue, line: { style: "solid", fill: C.cyan, width: 2 } });
    text(slide, n, { left: x, top: 371, width: 66, height: 20 }, { fontSize: 14, bold: true, alignment: "center" });
    text(slide, h, { left: x - 36, top: 445, width: 138, height: 28 }, { fontSize: 21, bold: true, alignment: "center" });
    text(slide, d, { left: x - 58, top: 484, width: 182, height: 46 }, { fontSize: 14, color: C.muted, alignment: "center" });
  });
}

// 07 — left visual, right content
{
  const slide = base("Left visual / right content", 7);
  title(slide, "Visual with supporting content", "Swap the visual orientation when the audience should meet evidence before explanation.");
  box(slide, { left: 78, top: 202, width: 480, height: 374 }, { fill: C.panel2, line: C.cyan, radius: "rounded-2xl" });
  text(slide, "Replace with visual", { left: 128, top: 335, width: 380, height: 32 }, { fontSize: 24, bold: true, alignment: "center" });
  text(slide, "Diagram, screenshot, or abstract art", { left: 128, top: 378, width: 380, height: 24 }, { fontSize: 15, color: C.muted, alignment: "center" });
  text(slide, "A precise explanation", { left: 666, top: 232, width: 420, height: 50 }, { fontSize: 30, bold: true });
  text(slide, "Use this space for a short narrative. The visual earns attention first, then the copy explains what it means and why it matters.", { left: 670, top: 312, width: 390, height: 100 }, { fontSize: 18, color: C.muted });
  text(slide, "Optional supporting note", { left: 670, top: 464, width: 330, height: 28 }, { fontSize: 16, bold: true, color: C.cyan });
}

// 08 — editable icon/capability grid
{
  const slide = base("Capability grid", 8);
  title(slide, "Capabilities at a glance", "Four editable slots for things the audience can compare quickly.");
  const cards = [
    ["01", "Account", "Identity, access, and balances"],
    ["02", "Assets", "Records that have ownership"],
    ["03", "Payments", "Movement and confirmation"],
    ["04", "History", "A clear trail of activity"],
  ];
  cards.forEach(([n, h, d], i) => {
    const x = 78 + (i % 2) * 545;
    const y = 206 + Math.floor(i / 2) * 188;
    box(slide, { left: x, top: y, width: 505, height: 145 }, { fill: C.panel2, line: C.line, radius: "rounded-xl" });
    slide.shapes.add({ geometry: "ellipse", position: { left: x + 28, top: y + 31, width: 64, height: 64 }, fill: C.blue, line: { style: "solid", fill: C.cyan, width: 1 } });
    text(slide, n, { left: x + 28, top: y + 52, width: 64, height: 20 }, { fontSize: 14, bold: true, alignment: "center" });
    text(slide, h, { left: x + 122, top: y + 30, width: 300, height: 30 }, { fontSize: 23, bold: true });
    text(slide, d, { left: x + 122, top: y + 72, width: 320, height: 34 }, { fontSize: 16, color: C.muted });
  });
}

// 09 — system architecture
{
  const slide = base("System architecture / integration diagram", 9);
  title(slide, "A clear system boundary", "An editable architecture pattern for BIS and its products.");
  const bis = box(slide, { left: 505, top: 286, width: 270, height: 122 }, { fill: C.blue, line: C.cyan, radius: "rounded-xl" });
  text(slide, "BIS", { left: 505, top: 311, width: 270, height: 36 }, { fontSize: 30, bold: true, alignment: "center" });
  text(slide, "Shared services", { left: 505, top: 354, width: 270, height: 24 }, { fontSize: 15, color: C.white, alignment: "center" });
  const admin = box(slide, { left: 84, top: 245, width: 245, height: 90 }, { fill: C.panel2, line: C.line });
  const market = box(slide, { left: 950, top: 245, width: 245, height: 90 }, { fill: C.panel2, line: C.line });
  const game = box(slide, { left: 505, top: 490, width: 270, height: 90 }, { fill: C.panel2, line: C.line });
  text(slide, "Admin", { left: 84, top: 265, width: 245, height: 28 }, { fontSize: 23, bold: true, alignment: "center" });
  text(slide, "Operations", { left: 84, top: 299, width: 245, height: 20 }, { fontSize: 14, color: C.muted, alignment: "center" });
  text(slide, "Marketplace", { left: 950, top: 265, width: 245, height: 28 }, { fontSize: 23, bold: true, alignment: "center" });
  text(slide, "Commerce", { left: 950, top: 299, width: 245, height: 20 }, { fontSize: 14, color: C.muted, alignment: "center" });
  text(slide, "Game", { left: 505, top: 510, width: 270, height: 28 }, { fontSize: 23, bold: true, alignment: "center" });
  text(slide, "Player experience", { left: 505, top: 544, width: 270, height: 20 }, { fontSize: 14, color: C.muted, alignment: "center" });
  slide.shapes.connect(admin, bis, { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.cyan, width: 2 }, head: { type: "arrow", width: "sm", length: "sm" } });
  slide.shapes.connect(bis, market, { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.cyan, width: 2 }, head: { type: "arrow", width: "sm", length: "sm" } });
  slide.shapes.connect(bis, game, { kind: "straight", fromSide: "bottom", toSide: "top", line: { style: "solid", fill: C.cyan, width: 2 }, head: { type: "arrow", width: "sm", length: "sm" } });
}

// 10 — comparison / decision table
{
  const slide = base("Comparison / decision table", 10);
  title(slide, "A decision in plain view", "A native editable table for comparing choices without visual noise.");
  const table = slide.tables.add({
    rows: 4,
    columns: 4,
    left: 78,
    top: 214,
    width: 1118,
    height: 280,
    values: [
      ["Option", "Best for", "Tradeoff", "Decision"],
      ["Option A", "Fast learning", "Limited coverage", "Use now"],
      ["Option B", "Broad coverage", "More effort", "Consider later"],
      ["Option C", "Specific edge case", "Narrow value", "Do not use"],
    ],
  });
  table.styleOptions = { headerRow: true, bandedRows: true };
  table.borders.assign({ style: "solid", fill: C.line, width: 1 });
  for (let col = 0; col < 4; col += 1) {
    table.getCell(0, col).fill = C.blue;
    table.getCell(0, col).text.style = { typeface: font, fontSize: 16, bold: true, color: C.white };
  }
  for (let row = 1; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      table.getCell(row, col).fill = row % 2 ? C.panel2 : C.panel;
      table.getCell(row, col).text.style = { typeface: font, fontSize: 15, color: col === 3 ? C.cyan : C.white, bold: col === 0 || col === 3 };
    }
  }
  text(slide, "Replace the examples with your actual options. Keep the decision column direct.", { left: 82, top: 540, width: 720, height: 26 }, { fontSize: 16, color: C.muted });
}

// 11 — icon library
{
  const slide = base("Icon library", 11);
  title(slide, "Icon library", "Fourteen original, individually reusable blue icons for technology, games, and blockchain topics.");
  const firstRow = ["NFT", "Blockchain", "Games", "Decentralized", "Metaverse", "Social networks", "Immutable"];
  const secondRow = ["Transparent", "Internet", "Wifi", "User", "Multiplayer", "Token", "Trophy"];
  const xPositions = [252, 366, 480, 594, 708, 822, 936];
  firstRow.forEach((label, i) => {
    art(slide, iconBytes[iconNames[i]], `${label} icon`, { left: xPositions[i], top: 152, width: 94, height: 146 });
    text(slide, label, { left: xPositions[i] - 8, top: 300, width: 110, height: 20 }, { fontSize: 13, bold: true, color: C.white, alignment: "center" });
  });
  secondRow.forEach((label, i) => {
    art(slide, iconBytes[iconNames[i + 7]], `${label} icon`, { left: xPositions[i], top: 362, width: 94, height: 146 });
    text(slide, label, { left: xPositions[i] - 8, top: 510, width: 110, height: 20 }, { fontSize: 13, bold: true, color: C.white, alignment: "center" });
  });
}

const stagingDir = path.join(TMP_DIR, ".codex-finalizer");
await fs.mkdir(stagingDir, { recursive: true });
const candidatePath = path.join(stagingDir, "rmc-template-candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

const result = await finalizePresentation({
  explicitTotalSlideCount: 11,
  requiredNativeTableOwnerSlides: [10],
  workspaceDir: WORKSPACE_DIR,
  candidatePath,
  finalPath: FINAL_PPTX,
  pythonExecutable: process.env.RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools", "inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools", "inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-heading-fit", "--require-native-table-slide", "10"],
  fontPolicy: { basis: "design", families: [font] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, `${path.basename(FINAL_PPTX)}.validation.json`),
});

console.log(JSON.stringify({ finalPath: FINAL_PPTX, font, result }, null, 2));
