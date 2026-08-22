/** Status codes worth retrying: transient upstream load and rate limits. */
const TRANSIENT = new Set([429, 500, 502, 503, 504]);

const statusOf = (error: unknown): number | undefined => {
  const status = (error as { status?: unknown })?.status;
  return typeof status === 'number' ? status : undefined;
};

/**
 * Retries a model call through transient upstream failures.
 *
 * Gemini regularly answers 503 "experiencing high demand" for a second or two.
 * Without this, a single blip ends the player's round with "Failed to
 * initialize chat" - which is a far worse outcome than waiting 400ms.
 */
export async function withRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const status = statusOf(error);

      // A 404 or 401 will fail identically forever, so do not spend time on it.
      if (status !== undefined && !TRANSIENT.has(status)) throw error;

      if (attempt < attempts - 1) {
        const backoff = 300 * 2 ** attempt + Math.random() * 200;
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }

  throw lastError;
}
