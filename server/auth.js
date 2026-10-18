// Авторизация: bcrypt-хеши паролей и JWT в заголовке Authorization / handshake сокета.
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { users } from './db.js';

const USERNAME_RE = /^[A-Za-zА-Яа-яЁё0-9_-]{3,20}$/;

export function validateCredentials(username, password) {
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return 'Ник: 3–20 символов — буквы, цифры, «_» или «-»';
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
    return 'Пароль: от 6 до 72 символов';
  }
  return null;
}

export const hashPassword = (password) => bcrypt.hash(password, 10);
export const checkPassword = (password, hash) => bcrypt.compare(password, hash);

export const signToken = (user) => jwt.sign({ sub: String(user.id) }, config.jwtSecret, { expiresIn: config.jwtTtl });

export function verifyToken(token) {
  if (typeof token !== 'string' || !token) return null;
  try {
    const id = Number(jwt.verify(token, config.jwtSecret).sub);
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}

export const isAutoAdminName = (username) => config.adminUsernames.includes(username.toLowerCase());

/** То, что можно показывать клиенту (без хеша пароля). */
export const publicUser = (u) => ({ id: u.id, username: u.username, role: u.role, isBanned: u.isBanned, banReason: u.banReason });

/** Пользователь из Bearer-токена. Роль и бан всегда читаются из базы, а не из токена. */
export function requireAuth(req, res, next) {
  const header = req.get('authorization') ?? '';
  const id = verifyToken(header.startsWith('Bearer ') ? header.slice(7) : '');
  const user = id && users.findById(id);
  if (!user) return res.status(401).json({ error: 'Требуется вход в аккаунт' });
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin' || req.user.isBanned) return res.status(403).json({ error: 'Только для администраторов' });
    next();
  });
}
