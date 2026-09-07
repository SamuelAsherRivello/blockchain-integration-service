import { useLayoutEffect, useRef, useState, type TextareaHTMLAttributes } from 'react';

/** Page by rendered size, preserving every character and the full report for Copy. */
export function ReportTextArea({ value, ...props }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'readOnly'> & { value: string }) {
  const field = useRef<HTMLTextAreaElement>(null);
  const [pages, setPages] = useState([value]);
  const [page, setPage] = useState(0);
  useLayoutEffect(() => {
    const element = field.current!;
    const measure = () => {
      if (!element.clientWidth || !element.clientHeight) return;
      const characters = Array.from(value), next: string[] = [];
      let start = 0;
      while (start < characters.length) {
        let low = start + 1, high = characters.length, end = low;
        while (low <= high) {
          const middle = Math.floor((low + high) / 2);
          element.value = characters.slice(start, middle).join('');
          if (element.scrollHeight <= element.clientHeight && element.scrollWidth <= element.clientWidth) {
            end = middle; low = middle + 1;
          } else high = middle - 1;
        }
        next.push(characters.slice(start, end).join('')); start = end;
      }
      element.value = next[0] ?? '';
      element.scrollTop = 0;
      setPages(next.length ? next : ['']); setPage(0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [value]);
  return <div className="bis-report">
    <textarea {...props} ref={field} readOnly value={pages[page] ?? ''} />
    <nav className="bis-report-pages" aria-label="Report pages">
      <button type="button" className="bis-button" disabled={page === 0} onClick={() => setPage(current => current - 1)}>Previous</button>
      <span role="status">{page + 1} / {pages.length}</span>
      <button type="button" className="bis-button" disabled={page >= pages.length - 1} onClick={() => setPage(current => current + 1)}>Next</button>
    </nav>
  </div>;
}
