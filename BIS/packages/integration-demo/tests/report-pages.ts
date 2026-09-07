/** Read every visible report page, asserting that pagination never clips text. */
export async function readReportPages(field: HTMLTextAreaElement) {
  const tick = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  await tick();
  await tick();
  await tick();
  const report = field.closest('.bis-report')!;
  const buttons = report.querySelectorAll<HTMLButtonElement>('.bis-report-pages button');
  const [previous, next] = buttons;
  let text = '';
  for (let count = 0; count < 1000; count++) {
    if (field.scrollHeight > field.clientHeight + 1 || field.scrollWidth > field.clientWidth + 1) throw Error('Report page clips text');
    text += field.value;
    if (next.disabled) {
      while (!previous.disabled) { previous.click(); await tick(); }
      return text;
    }
    next.click(); await tick();
  }
  throw Error('Report pagination did not terminate');
}
