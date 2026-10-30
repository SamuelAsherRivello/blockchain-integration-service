export function monitorUrl(network: string, address: string, base = globalThis.location.href) {
  const url = new URL('../events-monitor/', new URL('./', base));
  // Works from the sandbox root, setup, and any demo route.
  const sandbox = new URL(base).pathname.match(/^(.*\/prototype-sandbox)\//)?.[1];
  if (sandbox) url.pathname = `${sandbox}/events-monitor/`;
  url.search = new URLSearchParams({ network, address }).toString();
  return url.href;
}

let monitor: Window | null = null;
let capturedUrl = '';
const popupNameKey = 'bis-wallet-events-window';
function windowName() {
  const existing = sessionStorage.getItem(popupNameKey);
  if (existing) return existing;
  const name = `bis-wallet-events-${crypto.randomUUID()}`;
  sessionStorage.setItem(popupNameKey, name);
  return name;
}
export function demoOpenEventsMonitor(network: string, address: string) {
  const url = monitorUrl(network, address);
  if (monitor && !monitor.closed && capturedUrl === url) { monitor.focus(); return monitor; }
  monitor = window.open(url, windowName(), 'popup,width=500,height=400,resizable=yes');
  if (!monitor) throw new Error('Allow popups for this site, then click Execute again.');
  capturedUrl = url;
  monitor.focus();
  return monitor;
}
