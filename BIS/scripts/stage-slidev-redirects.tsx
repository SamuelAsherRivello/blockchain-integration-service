import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const routes = JSON.parse(await readFile(new URL('./slidev-legacy-routes.json', import.meta.url), 'utf8'));

function redirectPage(destination, slide = null, allowSlideHash = true) {
  const fallback = `${destination}${slide === null ? '' : `${slide}/#/${slide}`}`;
  const destinationJson = JSON.stringify(destination);
  const slideJson = JSON.stringify(slide);
  const allowSlideHashJson = JSON.stringify(allowSlideHash);
  return String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0;url=${fallback}">
  <title>Presentation moved</title>
  <script>
    const base = ${destinationJson};
    const pathSlide = ${slideJson};
    const hashMatch = ${allowSlideHashJson} && /^#\/([1-9]\d*)(?:\?|\/|$)/.exec(location.hash);
    const selectedSlide = hashMatch ? Number(hashMatch[1]) : pathSlide;
    const target = new URL(base + (selectedSlide === null ? '' : selectedSlide + '/'), location.origin);
    target.search = location.search;
    target.hash = selectedSlide === null ? location.hash : (hashMatch ? location.hash : '#/' + selectedSlide);
    location.replace(target.href);
  </script>
</head>
<body><p>This presentation has moved to <a href="${fallback}">its new location</a>.</p></body>
</html>
`;
}

async function writeRedirect(artifact, route, destination, slide = null, allowSlideHash = true) {
  const directory = resolve(artifact, route);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'index.html'), redirectPage(destination, slide, allowSlideHash));
}

export async function stageSlidevLegacyRedirects(artifact) {
  const { legacyBase, destinationBase, decks } = routes;
  if (legacyBase !== '/blockchain-integration-service/slidev/' || destinationBase !== '/blockchain-presentations/') {
    throw new Error('Unexpected Slidev redirect bases');
  }
  await writeRedirect(artifact, 'slidev', destinationBase, null, false);
  for (const [id, count] of Object.entries(decks)) {
    if (!/^[a-z0-9-]+$/.test(id) || !Number.isInteger(count) || count < 1) {
      throw new Error(`Invalid legacy Slidev route entry: ${id}`);
    }
    const destination = `${destinationBase}${id}/`;
    await writeRedirect(artifact, `slidev/${id}`, destination);
    for (let slide = 1; slide <= count; slide++) {
      await writeRedirect(artifact, `slidev/${id}/${slide}`, destination, slide);
    }
  }
}
