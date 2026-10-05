import type { TextareaHTMLAttributes } from 'react';

/** Keep the complete report available for vertical scrolling and manual copy. */
export function ReportTextArea({ value, ...props }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'readOnly'> & { value: string }) {
  return <div className="bis-report bis-report-scrollable">
    <textarea {...props} readOnly value={value} />
  </div>;
}
