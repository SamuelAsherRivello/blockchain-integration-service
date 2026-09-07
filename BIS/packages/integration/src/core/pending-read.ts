/** Read-only work. Never wrap a mutation or submission in this helper. */
export async function readWithRetry<T>(read: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal, timeout = 30000): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    parent?.throwIfAborted();
    const controller = new AbortController();
    const abort = () => controller.abort(parent?.reason);
    parent?.addEventListener('abort', abort, {once:true});
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: () => void = () => {};
    try {
      const interrupted = new Promise<never>((_, reject) => {
        onAbort = () => reject(controller.signal.reason);
        controller.signal.addEventListener('abort', onAbort, {once:true});
        timer = setTimeout(() => controller.abort(new Error('Loading timed out.')), timeout);
      });
      const value = await Promise.race([read(controller.signal), interrupted]);
      controller.signal.throwIfAborted();
      return value;
    } catch (error) {
      if (parent?.aborted || attempt === 1) throw error;
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener('abort', onAbort);
      parent?.removeEventListener('abort', abort);
      controller.abort();
    }
  }
}
