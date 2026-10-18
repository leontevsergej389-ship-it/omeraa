// API админ-панели. Каждое действие сразу доходит до игрока через Socket.io.
import { Router } from 'express';
import { formatPlate } from '../src/utils/plateEvaluator.js';
import { publicUser, requireAdmin } from './auth.js';
import { db, users } from './db.js';
import { addPlate, makeCustomPlate, mutateGame, setBalance, takePlate } from './game.js';

const money = (v) => `${new Intl.NumberFormat('ru-RU').format(Math.floor(v))} ₽`;

export function createAdminRouter(realtime) {
  const admin = Router();
  admin.use(requireAdmin);

  /** Игрок из тела запроса: по userId или username. */
  function targetOf(req, res) {
    const { userId, username } = req.body ?? {};
    const user = userId !== undefined ? users.findById(Number(userId)) : typeof username === 'string' ? users.findByUsername(username) : null;
    if (!user) res.status(404).json({ error: 'Игрок не найден' });
    return user;
  }

  const pushState = (userId, state) => realtime.toUser(userId, 'state', { state });

  admin.get('/users', (req, res) => {
    const list = users.all().map((u) => ({
      ...publicUser(u),
      online: realtime.isOnline(u.id),
      balance: u.balance,
      netWorth: u.netWorth,
      garageValue: u.netWorth - u.balance,
      garage: u.garage,
      spins: u.state.stats?.spins ?? 0,
      createdAt: u.createdAt,
      lastSeen: u.lastSeen,
    }));
    res.json({ users: list, online: realtime.onlineCount() });
  });

  admin.post('/give-plate', (req, res) => {
    const target = targetOf(req, res);
    if (!target) return;
    const { plate, error } = makeCustomPlate(req.body);
    if (error) return res.status(400).json({ error });

    const state = mutateGame(target.id, addPlate(plate));
    pushState(target.id, state);
    realtime.toUser(target.id, 'gift', { kind: 'plate', plate, from: req.user.username });
    res.json({ message: `Номер ${formatPlate(plate)} выдан игроку ${target.username}`, plate });
  });

  admin.post('/set-balance', (req, res) => {
    const target = targetOf(req, res);
    if (!target) return;
    const balance = Math.round(Number(req.body.balance));
    if (!Number.isFinite(balance) || balance < 0 || balance > 1e15) return res.status(400).json({ error: 'Баланс: от 0 до 10¹⁵ ₽' });

    let before = 0;
    const state = mutateGame(target.id, (s) => {
      before = s.balance;
      return setBalance(balance)(s);
    });
    pushState(target.id, state);
    const diff = balance - before;
    if (diff > 0) realtime.toUser(target.id, 'gift', { kind: 'balance', amount: Math.round(diff), balance, from: req.user.username });
    else if (diff < 0) realtime.toUser(target.id, 'notice', { kind: 'warning', title: 'Администратор изменил ваш баланс', text: `Новый баланс: ${money(balance)}` });
    res.json({ message: `Баланс ${target.username}: ${money(balance)}` });
  });

  admin.post('/ban', (req, res) => {
    const target = targetOf(req, res);
    if (!target) return;
    const banned = req.body.banned !== false;
    if (banned && target.id === req.user.id) return res.status(400).json({ error: 'Нельзя заблокировать самого себя' });
    const reason = String(req.body.reason ?? '').trim().slice(0, 300) || 'Нарушение правил игры';

    users.setBan(target.id, banned, reason);
    const user = publicUser(users.findById(target.id));
    realtime.toUser(target.id, 'user', { user });
    realtime.toUser(target.id, banned ? 'banned' : 'unbanned', { reason: user.banReason, by: req.user.username });
    res.json({ message: banned ? `${target.username} заблокирован` : `${target.username} разблокирован`, user });
  });

  admin.post('/confiscate', (req, res) => {
    const target = targetOf(req, res);
    if (!target) return;
    if (target.id === req.user.id) return res.status(400).json({ error: 'Это и так ваш номер' });
    const plateId = String(req.body.plateId ?? '');

    // Забрать у игрока и положить админу — одной транзакцией, чтобы номер не потерялся и не задвоился.
    let taken = null;
    const result = db.transaction(() => {
      const targetState = mutateGame(target.id, (s) => {
        const out = takePlate(s, plateId);
        taken = out.plate;
        return out.state;
      });
      if (!taken) return null;
      const adminState = mutateGame(req.user.id, addPlate({ ...taken, locked: false }));
      return { targetState, adminState };
    })();
    if (!result) return res.status(404).json({ error: 'У игрока нет такого номера' });

    pushState(target.id, result.targetState);
    pushState(req.user.id, result.adminState);
    realtime.toUser(target.id, 'notice', {
      kind: 'warning',
      title: 'Номер изъят администратором',
      text: `${formatPlate(taken)} больше не в вашем гараже`,
    });
    res.json({ message: `Номер ${formatPlate(taken)} изъят у ${target.username}` });
  });

  admin.post('/broadcast', (req, res) => {
    const message = String(req.body?.message ?? '').trim().slice(0, 500);
    if (!message) return res.status(400).json({ error: 'Пустое объявление' });
    realtime.toAll('broadcast', { message, from: req.user.username, at: Date.now() });
    res.json({ message: `Объявление отправлено (${realtime.onlineCount()} онлайн)` });
  });

  return admin;
}
