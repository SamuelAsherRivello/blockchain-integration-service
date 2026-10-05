export const MessageType = {Info:'info', Warning:'warning', Error:'error', Success:'success'} as const;
export type MessageType = typeof MessageType[keyof typeof MessageType];
export type BisToastOptions = Readonly<{ messageType?: MessageType; durationMs?: number; imageUrl?: string; icon?: 'lightning' }>;
export type ToastEntry = Readonly<{ id: number; messageType: MessageType; message: string; durationMs: number; imageUrl?: string; icon?: 'lightning' }>;

function toastImageUrl(value?: string): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return;
  const source = value.trim();
  if (source.startsWith('/') && !source.startsWith('//') && !source.includes('\\')) return source;
  try {
    const url = new URL(source);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch { /* Invalid optional artwork does not prevent the notification. */ }
}

/** Ephemeral notifications belong to a context, independently of account state. */
export function createToastQueue() {
  let entries: ToastEntry[] = [], nextId = 0, presentationGeneration = 0, disposed = false;
  const listeners = new Set<() => void>();
  const publish = () => { for (const listener of listeners) listener(); };
  function clear() {
    presentationGeneration++;
    entries = [];
    publish();
  }
  return {
    getSnapshot: (): ToastEntry | null => entries[0] ?? null,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    enqueue(message: string, options: BisToastOptions = {}) {
      if (disposed || !message.trim()) return;
      const duration = options.durationMs;
      const durationMs = typeof duration === 'number' && Number.isFinite(duration) && duration > 0 && duration <= 2147483647 ? duration : 3000;
      entries.push(Object.freeze({id: ++nextId, messageType: Object.values(MessageType).includes(options.messageType!) ? options.messageType! : MessageType.Info, message, durationMs, imageUrl: toastImageUrl(options.imageUrl), ...(options.icon === 'lightning' ? {icon: 'lightning' as const} : {})}));
      if (entries.length === 1) publish();
    },
    complete(id: number) {
      if (entries[0]?.id !== id) return;
      entries.shift(); publish();
    },
    attachPresentation() {
      const generation = ++presentationGeneration;
      // React effect replay reattaches synchronously; a real detach clears in the microtask.
      return () => { queueMicrotask(() => { if (generation === presentationGeneration) clear(); }); };
    },
    clear,
    dispose() { disposed = true; clear(); listeners.clear(); },
  };
}
