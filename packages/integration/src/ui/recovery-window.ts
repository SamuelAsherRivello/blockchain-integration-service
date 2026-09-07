import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ReportTextArea } from './ReportTextArea';
import type { BisTransferStatus } from '../core/context';
import { formatTransferRecoveryReport } from '../core/boarding-status';

export function openRecoveryWindow(status: BisTransferStatus): boolean {
  const report = formatTransferRecoveryReport(status);
  if (!report) return false;
  const popup = window.open('about:blank', '_blank', 'popup,width=720,height=760');
  if (!popup) return false;
  popup.opener = null;
  const doc = popup.document;
  doc.title = 'Recovery Info';
  doc.documentElement.lang = 'en';
  const style = doc.createElement('style');
  style.textContent = 'body{margin:24px;background:#111827;color:#f3f4f6;font:16px system-ui}textarea{box-sizing:border-box;width:100%;height:50vh;min-height:80px;overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;background:#1f2937;color:inherit;border:1px solid #4b5563;border-radius:8px;resize:none;font:14px/1.5 monospace}button{margin-top:16px;padding:10px 16px;background:#374151;color:inherit;border:1px solid #6b7280;border-radius:8px;cursor:pointer}';
  style.textContent += '.bis-report-pages{display:flex;align-items:center;justify-content:space-between;gap:8px}.bis-report-pages button{margin:8px 0}';
  const heading = doc.createElement('h1');
  heading.textContent = 'Recovery Info';
  const container = doc.createElement('div');
  const copy = doc.createElement('button');
  copy.textContent = 'Copy Recovery Info';
  const feedback = doc.createElement('p');
  feedback.setAttribute('role', 'status');
  copy.onclick = async () => {
    try { await popup.navigator.clipboard.writeText(report); feedback.textContent = 'Recovery info copied.'; }
    catch { const field = container.querySelector('textarea'); field?.focus(); field?.select(); feedback.textContent = 'Could not copy. Copy each report page manually.'; }
  };
  doc.head.append(style);
  doc.body.append(heading, copy, container, feedback);
  const root = createRoot(container);
  root.render(createElement(ReportTextArea, { value: report, 'aria-label': 'Recovery Info' }));
  popup.addEventListener?.('pagehide', () => root.unmount(), { once: true });
  return true;
}
