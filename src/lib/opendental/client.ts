import 'server-only';
import { env } from '@/lib/env';
import { OpenDentalError, OpenDentalAuthError, OpenDentalRateLimitError } from './errors';
import { logError } from '@/lib/logger';

interface RequestOptions {
  method?: string;
  params?: Record<string, string | number>;
  body?: unknown;
}

const MAX_RETRIES = 3;
const TIMEOUT_MS = 30000;

export async function fetchOpenDental<T>(
  developerKey: string,
  customerKey: string,
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const baseUrl = env.OPENDENTAL_BASE_URL || 'https://api.opendental.com/api/v1';
  const url = new URL(endpoint.replace(/^\//, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);

  if (options.params) {
    for (const [key, val] of Object.entries(options.params)) {
      if (val !== undefined && val !== null) {
        url.searchParams.append(key, String(val));
      }
    }
  }

  const headers: Record<string, string> = {
    Authorization: `ODFHIR ${developerKey}/${customerKey}`,
    Accept: 'application/json',
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  let attempt = 0;
  while (true) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        if (response.status === 204) return {} as T;
        return (await response.json()) as T;
      }

      const errorBody = await response.text().catch(() => '');

      if (response.status === 401 || response.status === 403) {
        throw new OpenDentalAuthError(`Open Dental authentication or permission error (${response.status})`);
      }

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) || 5 : 5;
        if (attempt <= MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
          continue;
        }
        throw new OpenDentalRateLimitError(retryAfterSeconds);
      }

      if (response.status >= 500 && attempt <= MAX_RETRIES) {
        const backoff = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }

      throw new OpenDentalError(response.status, `Open Dental API error ${response.status}: ${response.statusText}`, errorBody);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof OpenDentalError) throw err;

      const error = err instanceof Error ? err : new Error(String(err));
      if (attempt <= MAX_RETRIES && (error.name === 'AbortError' || error.message.includes('fetch'))) {
        const backoff = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }

      logError('Open Dental request failed', error, { endpoint });
      throw new OpenDentalError(500, `Open Dental network error: ${error.message}`);
    }
  }
}
