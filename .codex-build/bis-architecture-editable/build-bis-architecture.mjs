import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const workspaceDir = 'D:\\Documents\\Projects\\VC\\Bitcoin\\blockchain-integration-service';
const skillDir = 'C:\\Users\\srive\\.codex\\plugins\\cache\\openai-primary-runtime\\presentations\\26.905.11957\\skills\\presentations';
const buildDir = path.join(workspaceDir, '.codex-build', 'bis-architecture-editable');
const stagingDir = path.join(workspaceDir, '.codex-finalizer');
const finalPath = path.join(workspaceDir, 'output', 'presentations', 'bis-architecture-editable', 'bis-architecture-editable-v5.pptx');
const runtimePython = 'C:\\Users\\srive\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe';
const { resolvePresentationFont, finalizePresentation } = await import(pathToFileURL(
  path.join(skillDir, 'container_tools', 'artifact_tool_utils.mjs'),
).href);

await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(stagingDir, { recursive: true });
await fs.mkdir(path.dirname(finalPath), { recursive: true });
const font = resolvePresentationFont();
const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const slide = presentation.slides.add();
slide.background.fill = '#F8F7F4';

function card({ left, top, width, height, fill, line, text, color = '#132334', fontSize = 18, bold = false }) {
  const shape = slide.shapes.add({
    geometry: 'roundRect',
    position: { left, top, width, height },
    fill: { type: 'solid', color: fill },
    line: { style: 'solid', fill: line, width: 1.25 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: font, fontSize, color, bold,
    align: 'center', verticalAlignment: 'middle',
    marginLeft: 10, marginRight: 10, marginTop: 6, marginBottom: 6,
    autoFit: 'shrinkText',
  };
  return shape;
}

function column({ left, width, title, headerFill, border, cardFill, cards, cardTop, cardHeight, gap, cardFont = 17 }) {
  slide.shapes.add({
    geometry: 'roundRect', position: { left, top: 62, width, height: 594 },
    fill: { type: 'solid', color: '#FFFFFF' }, line: { style: 'solid', fill: border, width: 1 },
  });
  const header = slide.shapes.add({
    geometry: 'roundRect', position: { left, top: 62, width, height: 67 },
    fill: { type: 'solid', color: headerFill }, line: { style: 'solid', fill: headerFill, width: 1 },
  });
  header.text = title;
  header.text.style = { typeface: font, fontSize: 25, bold: true, color: '#FFFFFF', align: 'center', verticalAlignment: 'middle' };
  return { left, width, border, cardFill, cards, cardTop, cardHeight, gap, cardFont, __header: header };
}

const bis = column({
  left: 28, width: 346, title: 'BIS', headerFill: '#173E67', border: '#2D77B8', cardFill: '#DDEEFF',
  cards: ['Account / Wallet', 'Assets', 'Contracts', 'Payments', 'Transaction History'],
  cardTop: 155, cardHeight: 74, gap: 26, cardFont: 21,
});
const admin = column({
  left: 417, width: 248, title: 'Admin', headerFill: '#536779', border: '#8393A1', cardFill: '#E8EDF1',
  cards: ['A4. Account Dialog', 'C1. Mint Asset & Send', 'G2. LTO Treasure Chest'],
  cardTop: 180, cardHeight: 74, gap: 67, cardFont: 16.5,
});
const marketplace = column({
  left: 708, width: 248, title: 'Marketplace', headerFill: '#296E72', border: '#669FA1', cardFill: '#E1F1F0',
  cards: ['Stealth & Steel catalog', 'Game Wallet Login', 'Verified game-wallet inventory'],
  cardTop: 180, cardHeight: 74, gap: 67, cardFont: 16.5,
});
const game = column({
  left: 999, width: 252, title: 'Game', headerFill: '#65518A', border: '#9585AF', cardFill: '#EEE9F5',
  cards: ['Pay 1,000 sats to continue', '90-second LTO treasure offer', 'Achievement asset award'],
  cardTop: 180, cardHeight: 74, gap: 67, cardFont: 16.5,
});

const linkColor = '#244B68';
function route(points) {
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x1, y1] = points[i]; const [x2, y2] = points[i + 1];
    slide.shapes.add({
      geometry: 'line',
      position: { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.max(Math.abs(x2 - x1), 0.2), height: Math.max(Math.abs(y2 - y1), 0.2) },
      fill: 'none', line: { style: 'solid', fill: linkColor, width: 1.5 },
    });
  }
}

// Each route is composed of native, editable PowerPoint line segments.
// Cards are added afterwards so their opaque surfaces keep connector paths out of labels.
route([[350,192],[395,192],[395,217],[441,217]]);
route([[350,192],[402,192],[402,357],[732,357]]);
route([[350,292],[405,292],[405,357],[441,357]]);
route([[350,292],[690,292],[690,217],[732,217]]);
route([[350,292],[398,292],[398,545],[1023,545],[1023,497]]);
route([[350,392],[405,392],[405,497],[441,497]]);
route([[350,392],[398,392],[398,447],[1023,447],[1023,357]]);
route([[350,492],[385,492],[385,267],[1023,267],[1023,217]]);
route([[350,592],[690,592],[690,497],[732,497]]);

function addCards(group) {
  const output = {};
  group.cards.forEach((label, index) => {
    output[label] = card({
      left: group.left + 24, top: group.cardTop + index * (group.cardHeight + group.gap),
      width: group.width - 48, height: group.cardHeight, fill: group.cardFill, line: group.border,
      text: label, fontSize: group.cardFont,
    });
  });
  return output;
}
addCards(bis); addCards(admin); addCards(marketplace); addCards(game);

slide.speakerNotes.textFrame.setText('Architecture labels and relationships derived from the BIS repository, including the AdminPanel, MarketplacePanel, marketplace App, and treasure-session modules.');

const candidatePath = path.join(stagingDir, 'bis-architecture-editable-v5-candidate.pptx');
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
const preview = await presentation.export({ slide, format: 'png', scale: 1 });
await fs.writeFile(path.join(buildDir, 'bis-architecture-editable-preview.png'), new Uint8Array(await preview.arrayBuffer()));

const result = await finalizePresentation({
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: runtimePython,
  integrityValidatorPath: path.join(skillDir, 'container_tools', 'inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(skillDir, 'container_tools', 'inspect_presentation_layout_geometry.py'),
  layoutArgs: ['--expected-slide-size-emu', '12192000,6858000', '--validate-bullet-geometry', '--validate-heading-fit'],
  explicitTotalSlideCount: 1,
  requiredNativeTableOwnerSlides: [],
  fontPolicy: { basis: 'design', families: [font] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, 'bis-architecture-editable-v5.validation.json'),
});
console.log(JSON.stringify({ finalPath, font, result }, null, 2));
