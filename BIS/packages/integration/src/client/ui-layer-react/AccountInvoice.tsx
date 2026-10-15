import { useId } from 'react';
import type { BisInvoiceReceiving } from '../state-layer-core/invoice-receiving';
import { FormValue } from './FormValue';

export function AccountInvoice({ capability }: { capability: BisInvoiceReceiving }) {
  const descriptionId = useId();
  return <section className="bis-invoice" aria-label="Lightning invoice receiving" aria-describedby={descriptionId}>
    <div className="bis-address-row">
      <FormValue label="Lightning invoice" value="" disabled placeholder="No invoice" />
    </div>
    <div className="bis-invoice-options" role="group" aria-label="Invoice selection">
      <button type="button" className="bis-button bis-primary" aria-pressed="true" disabled>No Invoice</button>
      <button type="button" className="bis-button" aria-pressed="false" disabled>With Invoice</button>
    </div>
    <p className="bis-invoice-status" role="status">Currently unavailable</p>
    <p id={descriptionId} className="bis-invoice-help">Invoice controls affect only Lightning. {capability.reason}</p>
  </section>;
}
