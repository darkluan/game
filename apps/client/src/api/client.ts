import { runtimeConfig } from '@/lib/runtimeConfig';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
  }
}

/** The one place that calls fetch. Throws ApiError on any non-OK response. */
export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${runtimeConfig.serverUrl}${path}`, init);
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as { message?: unknown } | null)?.message;
    throw new ApiError(response.status, typeof message === 'string' ? message : response.statusText, body);
  }
  return body as T;
}
