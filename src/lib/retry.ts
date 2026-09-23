export class RetryableError extends Error {
  constructor(message: string, readonly retryAfterMs?: number) {
    super(message);
  }
}

export type RetryResult<T> = { value: T; attempts: number };

/**
 * 지수 백오프 + full jitter. RetryableError만 재시도하고 나머지는 즉시 던진다.
 * 서버가 Retry-After를 주면 그 값을 우선한다.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  { maxAttempts = 4, baseMs = 250, capMs = 4000 } = {},
): Promise<RetryResult<T>> {
  for (let attempt = 1; ; attempt++) {
    try {
      return { value: await fn(attempt), attempts: attempt };
    } catch (err) {
      if (!(err instanceof RetryableError) || attempt >= maxAttempts) {
        (err as Error & { attempts?: number }).attempts = attempt;
        throw err;
      }
      const backoff = err.retryAfterMs ?? Math.random() * Math.min(capMs, baseMs * 2 ** attempt);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
}
