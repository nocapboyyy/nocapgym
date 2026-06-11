import { getAuthHeaders } from './telegram';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

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
    const error = await response.json().catch(() => ({ message: 'Ошибка запроса' }));
    throw new Error(error.message ?? 'Ошибка запроса');
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
