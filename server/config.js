// Настройки сервера. Всё переопределяется переменными окружения.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(serverDir, '..');
const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(serverDir, 'data'));
fs.mkdirSync(dataDir, { recursive: true });

/** Секрет JWT: из окружения или сгенерированный один раз и сохранённый рядом с базой, чтобы токены переживали перезапуск. */
function loadJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(dataDir, '.jwt-secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  dbFile: path.join(dataDir, 'namerki.db'),
  distDir: path.join(rootDir, 'dist'),
  jwtSecret: loadJwtSecret(),
  jwtTtl: '30d',
  /** Ники, которые получают роль admin автоматически (без учёта регистра). */
  adminUsernames: (process.env.ADMIN_USERNAMES ?? 'Anton')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  /** Код для промокода «/makeadmin <код>». Пустая строка отключает промокод. */
  adminPromo: (process.env.ADMIN_PROMO ?? '7777').trim().toLowerCase(),
};
