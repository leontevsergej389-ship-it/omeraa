// Публичное API: регистрация, вход, промокоды, таблица лидеров.
import { Router } from 'express';
import { checkPassword, hashPassword, isAutoAdminName, publicUser, requireAuth, signToken, validateCredentials } from './auth.js';
import { config } from './config.js';
import { users } from './db.js';
import { newGameState } from './game.js';
import { rateLimit } from './rateLimit.js';

const authLimiter = rateLimit({ windowMs: 5 * 60_000, max: 30, message: 'Слишком много попыток входа. Подождите пару минут.' });
const promoLimiter = rateLimit({
  windowMs: 10 * 60_000,
  max: 10,
  message: 'Слишком много попыток ввода промокода. Попробуйте позже.',
  key: (req) => `${req.ip}:${req.user?.id}`,
});

const bestPlate = (garage) => garage.reduce((best, p) => (!best || p.value > best.value ? p : best), null);

export function createApiRouter(realtime) {
  const api = Router();

  api.post('/auth/register', authLimiter, async (req, res) => {
    const { username, password } = req.body ?? {};
    const invalid = validateCredentials(username, password);
    if (invalid) return res.status(400).json({ error: invalid });
    if (users.findByUsername(username)) return res.status(409).json({ error: 'Этот ник уже занят' });

    const user = users.create({
      username,
      passwordHash: await hashPassword(password),
      role: isAutoAdminName(username) ? 'admin' : 'user',
      state: newGameState(),
    });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  });

  api.post('/auth/login', authLimiter, async (req, res) => {
    const { username, password } = req.body ?? {};
    let user = typeof username === 'string' ? users.findByUsername(username) : null;
    if (!user || typeof password !== 'string' || !(await checkPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Неверный ник или пароль' });
    }
    if (user.role !== 'admin' && isAutoAdminName(user.username)) {
      users.setRole(user.id, 'admin');
      user = users.findById(user.id);
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  });

  api.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

  api.post('/promo', requireAuth, promoLimiter, (req, res) => {
    const code = String(req.body?.code ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
    // Пустой ADMIN_PROMO полностью отключает промокод.
    if (config.adminPromo && (code === `/makeadmin ${config.adminPromo}` || code === `makeadmin ${config.adminPromo}`)) {
      if (req.user.role === 'admin') return res.json({ message: 'Вы уже администратор', user: publicUser(req.user) });
      users.setRole(req.user.id, 'admin');
      const user = publicUser(users.findById(req.user.id));
      realtime.toUser(user.id, 'user', { user });
      return res.json({ message: 'Права администратора выданы', user });
    }
    res.status(404).json({ error: 'Промокод не найден' });
  });

  api.get('/leaderboard', requireAuth, (req, res) => {
    const top = users.top(50).map((u, i) => {
      const best = bestPlate(u.garage);
      return {
        rank: i + 1,
        id: u.id,
        username: u.username,
        role: u.role,
        online: realtime.isOnline(u.id),
        netWorth: u.netWorth,
        balance: u.balance,
        garageValue: u.netWorth - u.balance,
        garageCount: u.garage.length,
        legendary: u.state.stats?.tierCounts?.legendary ?? 0,
        best: best && { letters: best.letters, digits: best.digits, region: best.region, tier: best.tier, value: best.value },
      };
    });
    res.json({
      top,
      me: { rank: req.user.isBanned ? null : users.rankOf(req.user.netWorth), netWorth: req.user.netWorth },
      totalPlayers: users.activeCount(),
      online: realtime.onlineCount(),
    });
  });

  return api;
}
