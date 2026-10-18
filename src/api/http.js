// REST-клиент: JWT хранится в localStorage и уходит в заголовке Authorization.

const TOKEN_KEY = 'namerki-token';

/**
 * Адрес API-сервера. Пусто — тот же домен (dev-прокси Vite или `npm start`).
 * Если фронтенд и бэкенд на разных хостингах (например, Vercel + Render), задайте VITE_API_URL при сборке.
 */
export const API_URL = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // без localStorage токен живёт только до перезагрузки
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Сервер недоступен. Он запущен? (npm run dev)', 0);
  }
  const data = await res.json().catch(() => null);
  // Наш сервер всегда отвечает JSON. HTML-страница 404 значит, что запрос ушёл туда, где бэкенда нет (например, на Vercel).
  if (!data && res.status === 404) throw new ApiError('API-сервер не найден: бэкенд не запущен или не указан VITE_API_URL (см. README → «Деплой»)', 404);
  if (!res.ok) throw new ApiError(data?.error ?? `Ошибка сервера (${res.status})`, res.status);
  return data;
}
