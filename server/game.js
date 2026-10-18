// Серверный игровой движок. Тот же редьюсер, что и на клиенте, но номер генерирует только сервер,
// а от клиента принимаются лишь разрешённые действия с проверенными параметрами.
import { REGION_BY_CODE, TIER_RANK } from '../src/data/platesConfig.js';
import {
  createInitialState, gameReducer, normalizeState, pendingResolution, pendingSaleValue, OFFLINE_CAP_SEC,
} from '../src/state/gameState.js';
import { getIncomePerSec, getLuck, getSpinCost } from '../src/state/selectors.js';
import { buildPlate, formatPlate, generatePlate, getTier, isValidPlate, normalizeLetters } from '../src/utils/plateEvaluator.js';
import { users } from './db.js';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v.slice(0, 64) : '');

export function newGameState() {
  return createInitialState();
}

/** Собирает игровое состояние из строки базы. */
export function loadGame(user) {
  return normalizeState({ ...user.state, balance: user.balance, garage: user.garage });
}

/** Сохраняет новое состояние и увеличивает ревизию — по ней клиент отличает свежие данные от устаревших. */
function commit(user, prev, next) {
  if (next === prev) return prev;
  const saved = { ...next, rev: (prev.rev ?? 0) + 1 };
  users.saveGame(user.id, saved);
  return saved;
}

/** Начисляет аренду за время с последнего сохранения (не больше OFFLINE_CAP_SEC). */
const accrue = (state) => gameReducer(state, { type: 'TICK', maxSec: OFFLINE_CAP_SEC });

/** Изменяет состояние игрока через fn(state) → state и сохраняет результат. */
export function mutateGame(userId, fn) {
  const user = users.findById(userId);
  if (!user) return null;
  const prev = loadGame(user);
  return commit(user, prev, fn(accrue(prev)));
}

/** Вход в игру: начисляет доход за время отсутствия и возвращает отчёт для уведомления. */
export function openSession(user) {
  const prev = loadGame(user);
  const now = Date.now();
  const elapsed = (now - prev.lastSeen) / 1000;
  const hadIncome = getIncomePerSec(prev, now) > 0;
  const state = commit(user, prev, accrue(prev));
  const offline =
    elapsed > 30 && hadIncome ? { seconds: Math.min(elapsed, OFFLINE_CAP_SEC), amount: state.balance - prev.balance } : null;
  return { state, offline };
}

// ── Действия клиента ──────────────────────────────────────────────────────

const SETTINGS = {
  targetRegion: (v) => v === '' || Boolean(REGION_BY_CODE[v]),
  vip: (v) => typeof v === 'boolean',
  fastSpin: (v) => typeof v === 'boolean',
  autoSellCommon: (v) => typeof v === 'boolean',
};

const NO_PAYLOAD = new Set(['SPIN', 'KEEP_CURRENT', 'SELL_CURRENT', 'AUTO_RESOLVE', 'SUBSIDY', 'RESET']);
const WITH_ID = new Set(['SELL_PLATE', 'TOGGLE_LOCK', 'BUY_UPGRADE', 'BUY_BOOSTER', 'BUY_FRAME', 'SET_FRAME', 'CLAIM_ACHIEVEMENT', 'CLAIM_COLLECTION']);

/** Оставляет в действии только ожидаемые поля. null — действие недопустимо. */
function sanitize(action) {
  if (!isPlainObject(action) || typeof action.type !== 'string') return null;
  const { type } = action;
  if (NO_PAYLOAD.has(type)) return { type };
  if (WITH_ID.has(type)) return { type, id: str(action.id) };
  if (type === 'SELL_MANY') {
    const tiers = Array.isArray(action.tiers) ? action.tiers.filter((t) => TIER_RANK[t] !== undefined) : [];
    return tiers.length ? { type, tiers } : null;
  }
  if (type === 'SET_SETTING') {
    return SETTINGS[action.key]?.(action.value) ? { type, key: action.key, value: action.value } : null;
  }
  if (type === 'SET_STOP_ON') {
    return ['rare', 'epic', 'legendary'].includes(action.tier) && typeof action.value === 'boolean'
      ? { type, tier: action.tier, value: action.value }
      : null;
  }
  return null;
}

/** Прокрут на сервере: проверка денег, генерация номера, мгновенное «открытие» (анимация — забота клиента). */
function spin(state) {
  const now = Date.now();
  const pending = pendingResolution(state);
  if (pending === 'sell' && TIER_RANK[state.current.plate.tier] >= TIER_RANK.rare) {
    return { state, error: `Гараж заполнен: решите судьбу номера ${formatPlate(state.current.plate)}` };
  }
  const cost = getSpinCost(state, now);
  if (state.balance + pendingSaleValue(state, now) < cost) return { state, error: 'Не хватает денег на госпошлину' };

  const plate = generatePlate({ luck: getLuck(state, now), vip: state.settings.vip, targetRegion: state.settings.targetRegion });
  const next = gameReducer(gameReducer(state, { type: 'SPIN', plate, cost }), { type: 'REVEAL' });
  return { state: next, plate, cost };
}

/** Применяет действие игрока. Возвращает { state, plate?, error? }. */
export function applyClientAction(user, rawAction) {
  const action = sanitize(rawAction);
  const prev = loadGame(user);
  if (!action) return { state: prev, error: 'Недопустимое действие' };

  let state = accrue(prev);
  const result = {};
  if (action.type === 'SPIN') {
    const out = spin(state);
    state = out.state;
    if (out.error) result.error = out.error;
    else Object.assign(result, { plate: out.plate, cost: out.cost });
  } else {
    state = gameReducer(state, action);
  }
  return { ...result, state: commit(user, prev, state) };
}

// ── Действия администратора ───────────────────────────────────────────────

/** Собирает кастомный номер. value — необязательная цена, назначенная админом. */
export function makeCustomPlate({ letters, digits, region, value }) {
  const raw = { letters: normalizeLetters(letters ?? '').slice(0, 3), digits: String(digits ?? '').padStart(3, '0'), region: String(region ?? '') };
  if (!isValidPlate(raw)) return { error: 'Некорректный номер: 3 буквы ГОСТ, цифры 001–999 и существующий регион' };
  const plate = buildPlate(raw, { gifted: true });
  if (value !== undefined && value !== null && value !== '') {
    const price = Math.round(Number(value));
    if (!Number.isFinite(price) || price < 10 || price > 1e12) return { error: 'Цена: от 10 ₽ до 1 трлн ₽' };
    Object.assign(plate, { value: price, tier: getTier(price), customValue: true });
  }
  return { plate };
}

export const addPlate = (plate) => (state) => ({ ...state, garage: [plate, ...state.garage] });

export const setBalance = (balance) => (state) => ({ ...state, balance });

export function takePlate(state, plateId) {
  const plate = state.garage.find((p) => p.id === plateId);
  if (!plate) return { state, plate: null };
  return { state: { ...state, garage: state.garage.filter((p) => p.id !== plateId) }, plate };
}
