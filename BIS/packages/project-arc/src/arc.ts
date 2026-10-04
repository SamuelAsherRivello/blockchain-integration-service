export type ArcScene = {
  layout: string;
  eyebrow?: string;
  visual?: string;
  markdown: string;
};

export type ArcDocument = {
  title: string;
  theme: string;
  description?: string;
  scenes: ArcScene[];
};

function frontmatterValue(source: string, name: string) {
  return source.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))?.[1]?.trim();
}

function directiveValues(source: string) {
  return Object.fromEntries(source.split(';').map(entry => {
    const [key, ...value] = entry.trim().split('=');
    return [key.trim(), value.join('=').trim()];
  }).filter(([key, value]) => key && value));
}

/** Parses the deliberately small Arc Markdown dialect; the body remains ordinary Markdown. */
export function parseArc(source: string): ArcDocument {
  const normalized = source.replace(/\r\n/g, '\n').trim();
  const frontmatter = normalized.match(/^---\n([\s\S]*?)\n---\n*/);
  const header = frontmatter?.[1] ?? '';
  const sceneSource = normalized.slice(frontmatter?.[0].length ?? 0);
  const scenes = sceneSource.split(/\n---\n/).map(block => {
    const sceneSource = block.trimStart();
    const match = sceneSource.match(/^<!--\s*arc:\s*([\s\S]*?)-->\n*/);
    const values = directiveValues(match?.[1] ?? '');
    return {
      layout: values.layout || 'signal',
      eyebrow: values.eyebrow,
      visual: values.visual,
      markdown: sceneSource.slice(match?.[0].length ?? 0).trim(),
    };
  }).filter(scene => scene.markdown);
  return {
    title: frontmatterValue(header, 'title') || 'Untitled Arc',
    theme: frontmatterValue(header, 'theme') || 'midnight-signal',
    description: frontmatterValue(header, 'description'),
    scenes,
  };
}
