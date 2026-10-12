import { getAuthHeaders } from './telegram';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
export const telegramAuthExpiredEvent = 'telegram-auth-expired';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function readApiError(response: Response) {
  const body = (await response.json().catch(() => null)) as { code?: string; message?: string } | null;
  return new ApiError(body?.message ?? 'Ошибка запроса', response.status, body?.code);
}

export function getUserFacingApiError(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;
  if (error.code === 'VALIDATION_ERROR') {
    return 'Проверьте заполнение полей: некоторые значения недопустимы.';
  }
  return error.message;
}

export function buildRequestHeaders(
  authHeaders: Record<string, string>,
  optionHeaders: HeadersInit | undefined,
  hasJsonBody: boolean
) {
  return {
    ...(hasJsonBody ? { 'content-type': 'application/json' } : {}),
    ...authHeaders,
    ...optionHeaders
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const hasJsonBody = options.body !== undefined;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: buildRequestHeaders(getAuthHeaders(), options.headers, hasJsonBody)
  });

  if (!response.ok) {
    const error = await readApiError(response);
    if (error.code === 'TELEGRAM_AUTH_EXPIRED' && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(telegramAuthExpiredEvent));
    }
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' })
};
