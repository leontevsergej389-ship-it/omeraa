// Socket.io: игровые действия, онлайн-статус, живая лента дропа и уведомления от администрации.
import { Server } from 'socket.io';
import { TIER_RANK } from '../src/data/platesConfig.js';
import { publicUser, verifyToken } from './auth.js';
import { config } from './config.js';
import { users } from './db.js';
import { applyClientAction, mutateGame, openSession } from './game.js';

const room = (userId) => `user:${userId}`;
const DROP_FEED_SIZE = 20;
// Дроп показываем остальным, когда у самого игрока закончится анимация барабана.
const DROP_DELAY_MS = 700;
const ACCRUE_INTERVAL_MS = 60_000;
const MAX_ACTIONS_PER_SEC = 40;

export function createRealtime(httpServer) {
  const io = new Server(httpServer, {
    serveClient: false,
    // Фронтенд на другом домене (например, Vercel) подключается к сокету напрямую.
    cors: config.corsOrigins.length ? { origin: config.corsOrigins.includes('*') ? '*' : config.corsOrigins } : undefined,
  });
  const online = new Map(); // userId → число открытых вкладок
  const drops = [];

  const onlineCount = () => online.size;
  const broadcastOnline = () => io.emit('online', { count: online.size });

  io.use((socket, next) => {
    const id = verifyToken(socket.handshake.auth?.token);
    if (!id || !users.findById(id)) return next(new Error('unauthorized'));
    socket.data.userId = id;
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    const firstTab = !online.has(userId);
    online.set(userId, (online.get(userId) ?? 0) + 1);
    socket.join(room(userId));

    const user = users.findById(userId);
    const { state, offline } = openSession(user);
    socket.emit('session', {
      user: publicUser(user),
      state,
      offline: firstTab ? offline : null,
      drops,
      online: online.size,
    });
    broadcastOnline();

    let windowStart = Date.now();
    let actionsInWindow = 0;

    socket.on('game:action', (action, ack) => {
      if (typeof ack !== 'function') return;
      const now = Date.now();
      if (now - windowStart > 1000) {
        windowStart = now;
        actionsInWindow = 0;
      }
      if (++actionsInWindow > MAX_ACTIONS_PER_SEC) return ack({ error: 'Слишком много действий, притормозите' });

      try {
        const fresh = users.findById(userId);
        if (!fresh) return ack({ error: 'Аккаунт не найден' });
        if (fresh.isBanned) return ack({ error: 'Аккаунт заблокирован', banned: true });

        const res = applyClientAction(fresh, action);
        ack(res);
        // Остальные вкладки того же игрока получают свежее состояние.
        if (res.state) socket.to(room(userId)).emit('state', { state: res.state });
        if (res.plate && TIER_RANK[res.plate.tier] >= TIER_RANK.epic) {
          const { letters, digits, region, tier, value } = res.plate;
          const drop = { id: res.plate.id, username: fresh.username, plate: { letters, digits, region, tier, value }, at: now };
          setTimeout(() => {
            drops.unshift(drop);
            drops.length = Math.min(drops.length, DROP_FEED_SIZE);
            io.emit('drop', drop);
          }, DROP_DELAY_MS);
        }
      } catch (err) {
        console.error('[game:action]', err);
        ack({ error: 'Ошибка сервера' });
      }
    });

    socket.on('disconnect', () => {
      const left = (online.get(userId) ?? 1) - 1;
      if (left > 0) online.set(userId, left);
      else {
        online.delete(userId);
        mutateGame(userId, (s) => s); // фиксируем доход и время ухода
      }
      broadcastOnline();
    });
  });

  // Онлайн-игрокам аренда начисляется и без действий — чтобы не упираться в лимит офлайн-дохода
  // и чтобы таблица лидеров была свежей.
  setInterval(() => {
    for (const userId of online.keys()) mutateGame(userId, (s) => s);
  }, ACCRUE_INTERVAL_MS).unref();

  return {
    io,
    isOnline: (userId) => online.has(userId),
    onlineCount,
    /** Событие во все вкладки игрока. */
    toUser: (userId, event, payload) => io.to(room(userId)).emit(event, payload),
    toAll: (event, payload) => io.emit(event, payload),
  };
}
