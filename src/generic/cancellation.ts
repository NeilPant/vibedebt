export async function withCancellation<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort(new Error('Operation canceled; restoring the source snapshot if application began'));
  process.on('SIGINT', cancel); process.on('SIGTERM', cancel);
  try { return await work(controller.signal); }
  finally { process.off('SIGINT', cancel); process.off('SIGTERM', cancel); }
}
