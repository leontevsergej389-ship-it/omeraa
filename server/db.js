// SQLite-хранилище игроков (better-sqlite3: синхронный доступ, внешняя СУБД не нужна).
import Database from 'better-sqlite3';
import { config } from './config.js';

export const db = new Database(config.dbFile);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT    NOT NULL,
    usernameKey  TEXT    NOT NULL UNIQUE,         -- ник в нижнем регистре: NOCASE в SQLite не понимает кириллицу
    passwordHash TEXT    NOT NULL,
    role         TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    balance      REAL    NOT NULL DEFAULT 0,
    garage       TEXT    NOT NULL DEFAULT '[]',  -- JSON-массив номеров
    isBanned     INTEGER NOT NULL DEFAULT 0,
    banReason    TEXT    NOT NULL DEFAULT '',
    state        TEXT    NOT NULL DEFAULT '{}',  -- остальной прогресс: улучшения, статистика, достижения…
    netWorth     REAL    NOT NULL DEFAULT 0,     -- баланс + стоимость гаража, для таблицы лидеров
    createdAt    INTEGER NOT NULL,
    lastSeen     INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS users_networth ON users (netWorth DESC);
`);

export const usernameKey = (username) => username.trim().toLowerCase();

function parseJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    role: row.role,
    balance: row.balance,
    garage: parseJson(row.garage, []),
    isBanned: Boolean(row.isBanned),
    banReason: row.banReason,
    state: parseJson(row.state, {}),
    netWorth: row.netWorth,
    createdAt: row.createdAt,
    lastSeen: row.lastSeen,
  };
}

const stmt = {
  byId: db.prepare('SELECT * FROM users WHERE id = ?'),
  byName: db.prepare('SELECT * FROM users WHERE usernameKey = ?'),
  all: db.prepare('SELECT * FROM users ORDER BY netWorth DESC'),
  insert: db.prepare(`
    INSERT INTO users (username, usernameKey, passwordHash, role, balance, garage, state, netWorth, createdAt, lastSeen)
    VALUES (@username, @usernameKey, @passwordHash, @role, @balance, @garage, @state, @netWorth, @createdAt, @lastSeen)
  `),
  saveGame: db.prepare(`
    UPDATE users SET balance = @balance, garage = @garage, state = @state, netWorth = @netWorth, lastSeen = @lastSeen
    WHERE id = @id
  `),
  setRole: db.prepare('UPDATE users SET role = ? WHERE id = ?'),
  setBan: db.prepare('UPDATE users SET isBanned = ?, banReason = ? WHERE id = ?'),
  top: db.prepare('SELECT * FROM users WHERE isBanned = 0 ORDER BY netWorth DESC LIMIT ?'),
  rank: db.prepare('SELECT COUNT(*) + 1 AS rank FROM users WHERE isBanned = 0 AND netWorth > ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM users WHERE isBanned = 0'),
};

/** Разделяет игровое состояние на колонки таблицы: balance и garage отдельно, остальное — JSON. */
function gameColumns(state) {
  const { balance, garage, ...rest } = state;
  const garageValue = garage.reduce((sum, p) => sum + p.value, 0);
  return {
    balance,
    garage: JSON.stringify(garage),
    state: JSON.stringify(rest),
    netWorth: balance + garageValue,
    lastSeen: Date.now(),
  };
}

export const users = {
  findById: (id) => toUser(stmt.byId.get(id)),
  findByUsername: (username) => toUser(stmt.byName.get(usernameKey(username))),
  all: () => stmt.all.all().map(toUser),
  top: (limit) => stmt.top.all(limit).map(toUser),
  rankOf: (netWorth) => stmt.rank.get(netWorth).rank,
  activeCount: () => stmt.count.get().n,

  create({ username, passwordHash, role, state }) {
    const now = Date.now();
    const info = stmt.insert.run({ username, usernameKey: usernameKey(username), passwordHash, role, createdAt: now, ...gameColumns(state) });
    return users.findById(info.lastInsertRowid);
  },

  saveGame(id, state) {
    stmt.saveGame.run({ id, ...gameColumns(state) });
  },

  setRole(id, role) {
    stmt.setRole.run(role, id);
  },

  setBan(id, isBanned, reason) {
    stmt.setBan.run(isBanned ? 1 : 0, isBanned ? reason : '', id);
  },
};
