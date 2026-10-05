import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "D:/Documents/Projects/VC/Bitcoin/blockchain-integration-service";
const outputDir = path.join(workspaceDir, "output/reports/recover-rmc-slides");
const decks = [
  "RMC-Template-v3-art-direction-review.pptx",
  "RMC-Template-v4-art-direction-review.pptx",
];

await fs.mkdir(outputDir, { recursive: true });
for (const filename of decks) {
  const deckPath = path.join(workspaceDir, "BIS/marketing/rmc-template/exports", filename);
  const presentation = await PresentationFile.importPptx(await FileBlob.load(deckPath));
  const inspection = await presentation.inspect({
    kind: "deck,slide,textbox,shape,image,table,chart,notes,layout",
    maxChars: 30000,
  });
  await fs.writeFile(path.join(outputDir, `${filename}.inspect.ndjson`), inspection.ndjson);
  for (const slideNumber of [13, 14, 15, 16]) {
    const slide = presentation.slides.getItem(slideNumber - 1);
    const png = await slide.export({ format: "png", scale: 1 });
    await fs.writeFile(
      path.join(outputDir, `${path.basename(filename, ".pptx")}-slide-${slideNumber}.png`),
      new Uint8Array(await png.arrayBuffer()),
    );
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(path.join(outputDir, `${path.basename(filename, ".pptx")}-slide-${slideNumber}.layout.json`), await layout.text());
  }
}
