/** Polling helpers: contract state lands a few seconds after a transaction. */

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry `probe` until it returns a truthy value. Returns `null` when the tries
 * are exhausted, so callers can decide whether that is fatal.
 */
export async function waitFor<T>(
  probe: () => Promise<T | null | undefined | false>,
  options: { tries?: number; delayMs?: number } = {},
): Promise<T | null> {
  const tries = options.tries ?? 12
  const delayMs = options.delayMs ?? 2500
  for (let attempt = 0; attempt < tries; attempt++) {
    const result = await probe()
    if (result) return result as T
    if (attempt < tries - 1) await sleep(delayMs)
  }
  return null
}
