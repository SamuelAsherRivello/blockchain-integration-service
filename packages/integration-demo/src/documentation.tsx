import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Markdown from 'react-markdown';
import source from '../../../documentation/User Story Diagrams.md?raw';
import './documentation.css';

let diagramId = 0;
type HeadingNode = { type: string; value?: string; tagName?: string; properties?: Record<string, unknown>; children?: HeadingNode[] };
function headingAnchors() {
  return (tree: HeadingNode) => {
    const used = new Set<string>();
    const text = (node: HeadingNode): string => node.type === 'text' ? node.value ?? '' : (node.children ?? []).map(text).join('');
    const visit = (node: HeadingNode) => {
      if (node.tagName && /^h[1-6]$/.test(node.tagName)) {
        const base = text(node).toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/ /g, '-');
        let id = base;
        for (let suffix = 1; used.has(id); suffix++) id = `${base}-${suffix}`;
        used.add(id);
        node.properties = { ...node.properties, id };
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
function Diagram({ code }: { code: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'dark' });
        const { svg } = await mermaid.render(`story-diagram-${++diagramId}`, code);
        if (active && container.current) container.current.innerHTML = svg;
      } catch { if (active) setError(true); }
    })();
    return () => { active = false; };
  }, [code]);
  return error ? <><p>Unable to render this diagram.</p><pre>{code}</pre></> : <div className="diagram" ref={container} />;
}

function Documentation() {
  return <main>
    <a href="../../">← Back to demo</a>
    {source.trim() ? <Markdown rehypePlugins={[headingAnchors]} components={{
      pre: ({ children }) => <div className="code-block">{children}</div>,
      code: ({ className, children }) => className === 'language-mermaid'
        ? <Diagram code={String(children).trim()} />
        : <code className={className}>{children}</code>,
    }}>{source}</Markdown> : <><h1>User Story Diagrams</h1><p>No user-story documentation has been added yet.</p></>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<Documentation />);
