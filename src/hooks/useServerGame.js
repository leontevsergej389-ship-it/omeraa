import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { gameReducer } from '../state/gameState.js';

const ACTION_TIMEOUT_MS = 10_000;
const REALTIME_EVENTS = ['drop', 'gift', 'banned', 'unbanned', 'broadcast', 'notice'];

/**
 * Игровое состояние, синхронизированное с сервером.
 *
 * Сервер — источник истины. Действия применяются локально сразу (тот же редьюсер, что на сервере),
 * а ответ сервера затем заменяет локальную версию. Каждое серверное состояние несёт номер ревизии `rev`:
 * пока есть запросы «в полёте», промежуточные ответы откладываются, чтобы интерфейс не мигал,
 * и применяется самый свежий.
 */
export function useServerGame(token, onEvent) {
  const [status, setStatus] = useState('connecting'); // connecting | ready | reconnecting | offline
  const [state, setState] = useState(null);
  const [user, setUser] = useState(null);
  const [online, setOnline] = useState(0);

  const stateRef = useRef(null);
  stateRef.current = state;
  const socketRef = useRef(null);
  const pending = useRef(0);
  const stash = useRef(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  /** Предлагает серверное состояние к применению. */
  const settle = useCallback((incoming) => {
    let best = incoming ?? null;
    if (stash.current && (!best || stash.current.rev > best.rev)) best = stash.current;
    if (pending.current > 0) {
      stash.current = best;
      return;
    }
    stash.current = null;
    if (best) setState((prev) => (!prev || best.rev >= prev.rev ? best : prev));
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    const socket = io({ auth: { token } });
    socketRef.current = socket;
    const emit = (type, payload) => onEventRef.current?.(type, payload);

    socket.on('session', (session) => {
      stash.current = null;
      setUser(session.user);
      setState(session.state);
      setOnline(session.online);
      setStatus('ready');
      emit('session', session);
    });
    socket.on('state', ({ state: next }) => settle(next));
    socket.on('user', ({ user: next }) => setUser(next));
    socket.on('online', ({ count }) => setOnline(count));
    REALTIME_EVENTS.forEach((ev) => socket.on(ev, (payload) => emit(ev, payload)));
    socket.on('disconnect', () => setStatus((s) => (s === 'ready' ? 'reconnecting' : s)));
    socket.on('connect_error', (err) => {
      if (err.message === 'unauthorized') emit('unauthorized');
      else setStatus((s) => (s === 'connecting' ? 'offline' : s));
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, settle]);

  // Аренда капает на экране каждые полсекунды; сервер начисляет то же самое у себя.
  useEffect(() => {
    const id = setInterval(() => setState((prev) => prev && gameReducer(prev, { type: 'TICK' })), 500);
    return () => clearInterval(id);
  }, []);

  /**
   * Отправляет действие на сервер. optimistic — применить локально сразу;
   * hold — не применять ответ автоматически (прокрут ждёт конца анимации и зовёт commit сам).
   */
  const send = useCallback(
    (action, { optimistic = true, hold = false } = {}) =>
      new Promise((resolve) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          resolve({ error: 'Нет связи с сервером' });
          return;
        }
        if (optimistic) setState((prev) => prev && gameReducer(prev, action));
        pending.current += 1;
        socket.timeout(ACTION_TIMEOUT_MS).emit('game:action', action, (err, res) => {
          pending.current = Math.max(0, pending.current - 1);
          const response = err ? { error: 'Сервер не ответил' } : (res ?? { error: 'Пустой ответ сервера' });
          if (!hold) settle(response.state);
          resolve(response);
        });
      }),
    [settle],
  );

  const dispatch = useCallback(
    (action) => {
      send(action).then((res) => {
        if (res.error) onEventRef.current?.('action-error', res);
      });
    },
    [send],
  );

  const spin = useCallback(() => send({ type: 'SPIN' }, { optimistic: false, hold: true }), [send]);

  return { status, state, user, online, stateRef, dispatch, spin, commit: settle };
}
