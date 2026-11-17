import type { Browser } from '@playwright/test';

export function throwIfCanceled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('Browser execution canceled');
}
async function boundedClose(browser: Browser): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      browser.close({ reason: 'Browser execution finished or canceled' }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Browser cleanup deadline exceeded (20000ms)')), 20000);
      }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}
export function cancellationScope(browser: Browser, signal?: AbortSignal) {
  let closing: Promise<void> | undefined;
  const abort = () => {
    closing ??= boundedClose(browser);
    // Retain the rejected promise for finally while avoiding an unhandled rejection.
    void closing.catch(() => undefined);
  };
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  return {
    check: () => throwIfCanceled(signal),
    async close(): Promise<void> {
      signal?.removeEventListener('abort', abort);
      try { await (closing ?? boundedClose(browser)); }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${signal?.aborted ? 'Browser execution canceled; ' : ''}${message}`);
      }
    },
  };
}
