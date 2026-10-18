import { useCallback, useState } from 'react';
import { api, getToken, setToken } from '../api/http.js';

/** Токен текущего игрока; mode — 'login' или 'register'. */
export function useAuth() {
  const [token, setTokenState] = useState(getToken);

  const authenticate = useCallback(async (mode, username, password) => {
    const data = await api(`/auth/${mode}`, { method: 'POST', body: { username, password } });
    setToken(data.token);
    setTokenState(data.token);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
  }, []);

  return { token, authenticate, logout };
}
