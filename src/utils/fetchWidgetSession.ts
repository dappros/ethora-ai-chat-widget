const RETRY_DELAYS_MS = [1000, 2000];

/** Retry transient failures a limited number of times; 4xx are never retried. */
export async function fetchWidgetSession(
  url: string,
  options: RequestInit,
  request: typeof fetch = fetch,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await request(url, options);
      if (response.status < 500 || attempt >= RETRY_DELAYS_MS.length) return response;
    } catch (error) {
      if (attempt >= RETRY_DELAYS_MS.length) throw error;
    }
    await wait(RETRY_DELAYS_MS[attempt]);
  }
}
