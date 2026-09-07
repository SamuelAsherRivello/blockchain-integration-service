/** Live creation remains gated until a supported Signet route is verified. */
export type BisInvoiceReceiving = Readonly<{
  status: 'unavailable';
  reason: string;
}>;

export const unavailableInvoiceReceiving: BisInvoiceReceiving = Object.freeze({
  status: 'unavailable',
  reason: 'No supported Signet receiving service is configured.',
});
