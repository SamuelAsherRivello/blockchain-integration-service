/** Read the full report and verify that overflow remains reachable by scrolling. */
export async function readReportPages(field: HTMLTextAreaElement) {
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  if (field.closest('.bis-report')?.querySelector('nav')) throw Error('Report must not paginate');
  if (field.scrollWidth > field.clientWidth + 1) throw Error('Report overflows horizontally');
  if (field.scrollHeight > field.clientHeight) {
    field.scrollTop = field.scrollHeight;
    if (field.scrollTop <= 0) throw Error('Report cannot scroll');
    field.scrollTop = 0;
  }
  return field.value;
}
