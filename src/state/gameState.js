// Игровое состояние: начальные значения, редьюсер и нормализация сохранений.
// Модуль общий для клиента (оптимистичные обновления) и сервера (источник истины).
import { SPIN_ECONOMY, TIERS, TIER_RANK } from '../data/platesConfig.js';
import { UPGRADE_BY_ID, upgradeCost, BOOSTER_BY_ID, FRAME_BY_ID } from '../data/shopConfig.js';
import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID, COLLECTIONS, COLLECTION_BY_ID } from '../data/achievementsConfig.js';
import { salePrice, isValidPlate } from '../utils/plateEvaluator.js';
import { achievementContext, getCapacity, getIncomePerSec, getSaleMult, getSpinCost } from './selectors.js';

export const OFFLINE_CAP_SEC = 2 * 60 * 60;
const SUBSIDY_AMOUNT = 5000;
const RECENT_LIMIT = 12;

const emptyTierCounts = () => Object.fromEntries(TIERS.map((t) => [t.id, 0]));

export function createInitialState() {
  const now = Date.now();
  return {
    version: 1,
    rev: 0, // номер ревизии: сервер увеличивает его при каждом сохранении
    createdAt: now,
    lastSeen: now,
    balance: SPIN_ECONOMY.startBalance,
    garage: [],
    recent: [], // последние выпавшие номера для ленты истории
    current: null, // { plate, revealed, handled, action?: 'kept' | 'sold', soldFor? }
    upgrades: { luck: 0, appraisal: 0, garage: 0, rent: 0, conveyor: 0 },
    boosters: {}, // id → timestamp окончания
    frames: { owned: ['standard'], active: 'standard' },
    settings: {
      fastSpin: false,
      targetRegion: '',
      vip: false,
      autoSellCommon: true,
      stopOn: { rare: false, epic: true, legendary: true },
    },
    stats: {
      spins: 0,
      vipSpins: 0,
      sold: 0,
      earned: 0,
      spent: 0,
      shopSpent: 0,
      passiveEarned: 0,
      rewards: 0,
      subsidies: 0,
      bestValue: 0,
      bestPlate: null,
      tierCounts: emptyTierCounts(),
      bingo: 0,
      combo: 0,
    },
    discovered: {}, // collectionId → { key: true }
    achievements: { unlocked: {}, claimed: {} },
    collectionsClaimed: {},
  };
}

// ── Помощники ─────────────────────────────────────────────────────────────

const hasSpace = (state) => state.garage.length < getCapacity(state);

function creditSale(state, plates, now) {
  const mult = getSaleMult(state, now);
  const total = plates.reduce((sum, p) => sum + salePrice(p, mult), 0);
  return {
    total,
    patch: {
      balance: state.balance + total,
      stats: { ...state.stats, sold: state.stats.sold + plates.length, earned: state.stats.earned + total },
    },
  };
}

/** Фиксирует выпавший номер: статистика, коллекции. Вызывается в момент «открытия». */
export function revealCurrent(state) {
  const { current } = state;
  if (!current || current.revealed) return state;
  const plate = current.plate;
  const stats = {
    ...state.stats,
    tierCounts: { ...state.stats.tierCounts, [plate.tier]: (state.stats.tierCounts[plate.tier] ?? 0) + 1 },
    bingo: state.stats.bingo + (plate.bingo ? 1 : 0),
    combo: state.stats.combo + (plate.combo ? 1 : 0),
  };
  if (plate.value > stats.bestValue) {
    stats.bestValue = plate.value;
    stats.bestPlate = { letters: plate.letters, digits: plate.digits, region: plate.region, tier: plate.tier, value: plate.value };
  }
  const discovered = { ...state.discovered };
  for (const c of COLLECTIONS) {
    const key = c.keyOf(plate);
    if (key && c.items.includes(key) && !discovered[c.id]?.[key]) {
      discovered[c.id] = { ...discovered[c.id], [key]: true };
    }
  }
  const recent = [{ id: plate.id, letters: plate.letters, digits: plate.digits, region: plate.region, tier: plate.tier, value: plate.value }, ...state.recent].slice(0, RECENT_LIMIT);
  return { ...state, stats, discovered, recent, current: { ...current, revealed: true } };
}

function sellCurrent(state, now) {
  const { total, patch } = creditSale(state, [state.current.plate], now);
  return { ...state, ...patch, current: { ...state.current, handled: true, action: 'sold', soldFor: total } };
}

function keepCurrent(state) {
  return { ...state, garage: [state.current.plate, ...state.garage], current: { ...state.current, handled: true, action: 'kept' } };
}

/** Что произойдёт с неразобранным номером при следующем ручном прокруте. */
export function pendingResolution(state) {
  const c = state.current;
  if (!c || c.handled) return null;
  return TIER_RANK[c.plate.tier] >= TIER_RANK.rare && hasSpace(state) ? 'keep' : 'sell';
}

/** Деньги, которые вернутся от автопродажи неразобранного номера (нужно для проверки баланса). */
export function pendingSaleValue(state, now = Date.now()) {
  return pendingResolution(state) === 'sell' ? salePrice(state.current.plate, getSaleMult(state, now)) : 0;
}

function resolvePending(state, now) {
  if (!state.current || state.current.handled) return state;
  const s = revealCurrent(state);
  return pendingResolution(s) === 'keep' ? keepCurrent(s) : sellCurrent(s, now);
}

export const isCollectionComplete = (state, c) => c.items.every((k) => state.discovered[c.id]?.[k]);

export function canGetSubsidy(state, now = Date.now()) {
  return (
    state.balance + pendingSaleValue(state, now) < getSpinCost(state, now) &&
    state.garage.length === 0 &&
    (!state.current || state.current.handled || pendingResolution(state) === 'sell')
  );
}

/** Отмечает новые выполненные достижения (сохраняются навсегда, даже если условие потом перестало выполняться). */
function syncAchievements(state, now) {
  const ctx = achievementContext(state, now);
  let unlocked = null;
  for (const a of ACHIEVEMENTS) {
    if (state.achievements.unlocked[a.id]) continue;
    const [cur, target] = a.progress(ctx);
    if (cur >= target) {
      unlocked ??= { ...state.achievements.unlocked };
      unlocked[a.id] = now;
    }
  }
  return unlocked ? { ...state, achievements: { ...state.achievements, unlocked } } : state;
}

// ── Редьюсер ──────────────────────────────────────────────────────────────

function reduce(state, action, now) {
  switch (action.type) {
    case 'SPIN': {
      const s = resolvePending(state, now);
      if (s.balance < action.cost) return s;
      return {
        ...s,
        balance: s.balance - action.cost,
        current: { plate: action.plate, revealed: false, handled: false },
        stats: {
          ...s.stats,
          spins: s.stats.spins + 1,
          vipSpins: s.stats.vipSpins + (action.plate.vip ? 1 : 0),
          spent: s.stats.spent + action.cost,
        },
      };
    }

    case 'REVEAL':
      return revealCurrent(state);

    case 'KEEP_CURRENT': {
      const c = state.current;
      if (!c || c.handled || !c.revealed || !hasSpace(state)) return state;
      return keepCurrent(state);
    }

    case 'SELL_CURRENT': {
      const c = state.current;
      if (!c || c.handled || !c.revealed) return state;
      return sellCurrent(state, now);
    }

    case 'AUTO_RESOLVE': {
      const c = state.current;
      if (!c || c.handled || !c.revealed) return state;
      if (c.plate.tier === 'common' && state.settings.autoSellCommon) return sellCurrent(state, now);
      return hasSpace(state) ? keepCurrent(state) : sellCurrent(state, now);
    }

    case 'SELL_PLATE': {
      const plate = state.garage.find((p) => p.id === action.id);
      if (!plate || plate.locked) return state;
      const { patch } = creditSale(state, [plate], now);
      return { ...state, ...patch, garage: state.garage.filter((p) => p.id !== action.id) };
    }

    case 'SELL_MANY': {
      const toSell = state.garage.filter((p) => !p.locked && action.tiers.includes(p.tier));
      if (!toSell.length) return state;
      const ids = new Set(toSell.map((p) => p.id));
      const { patch } = creditSale(state, toSell, now);
      return { ...state, ...patch, garage: state.garage.filter((p) => !ids.has(p.id)) };
    }

    case 'TOGGLE_LOCK':
      return { ...state, garage: state.garage.map((p) => (p.id === action.id ? { ...p, locked: !p.locked } : p)) };

    case 'BUY_UPGRADE': {
      const up = UPGRADE_BY_ID[action.id];
      const level = state.upgrades[action.id] ?? 0;
      if (!up || level >= up.maxLevel) return state;
      const cost = upgradeCost(up, level);
      if (state.balance < cost) return state;
      return {
        ...state,
        balance: state.balance - cost,
        upgrades: { ...state.upgrades, [action.id]: level + 1 },
        stats: { ...state.stats, shopSpent: state.stats.shopSpent + cost },
      };
    }

    case 'BUY_BOOSTER': {
      const b = BOOSTER_BY_ID[action.id];
      if (!b || state.balance < b.cost) return state;
      const from = Math.max(now, state.boosters[action.id] ?? 0);
      return {
        ...state,
        balance: state.balance - b.cost,
        boosters: { ...state.boosters, [action.id]: from + b.duration * 1000 },
        stats: { ...state.stats, shopSpent: state.stats.shopSpent + b.cost },
      };
    }

    case 'BUY_FRAME': {
      const f = FRAME_BY_ID[action.id];
      if (!f || state.frames.owned.includes(f.id) || state.balance < f.cost) return state;
      return {
        ...state,
        balance: state.balance - f.cost,
        frames: { owned: [...state.frames.owned, f.id], active: f.id },
        stats: { ...state.stats, shopSpent: state.stats.shopSpent + f.cost },
      };
    }

    case 'SET_FRAME':
      if (!state.frames.owned.includes(action.id)) return state;
      return { ...state, frames: { ...state.frames, active: action.id } };

    case 'SET_SETTING':
      return { ...state, settings: { ...state.settings, [action.key]: action.value } };

    case 'SET_STOP_ON':
      return { ...state, settings: { ...state.settings, stopOn: { ...state.settings.stopOn, [action.tier]: action.value } } };

    case 'CLAIM_ACHIEVEMENT': {
      const a = ACHIEVEMENT_BY_ID[action.id];
      if (!a || !state.achievements.unlocked[a.id] || state.achievements.claimed[a.id]) return state;
      return {
        ...state,
        balance: state.balance + a.reward,
        achievements: { ...state.achievements, claimed: { ...state.achievements.claimed, [a.id]: now } },
        stats: { ...state.stats, rewards: state.stats.rewards + a.reward },
      };
    }

    case 'CLAIM_COLLECTION': {
      const c = COLLECTION_BY_ID[action.id];
      if (!c || state.collectionsClaimed[c.id] || !isCollectionComplete(state, c)) return state;
      return {
        ...state,
        balance: state.balance + c.reward,
        collectionsClaimed: { ...state.collectionsClaimed, [c.id]: now },
        stats: { ...state.stats, rewards: state.stats.rewards + c.reward },
      };
    }

    case 'TICK': {
      // Клиент тикает каждые полсекунды (≤5 с), сервер начисляет за всё время отсутствия (≤ OFFLINE_CAP_SEC).
      const dt = Math.min(action.maxSec ?? 5, Math.max(0, (now - state.lastSeen) / 1000));
      const income = getIncomePerSec(state, now) * dt;
      if (income <= 0) return { ...state, lastSeen: now };
      return {
        ...state,
        lastSeen: now,
        balance: state.balance + income,
        stats: { ...state.stats, passiveEarned: state.stats.passiveEarned + income },
      };
    }

    case 'SUBSIDY':
      if (!canGetSubsidy(state, now)) return state;
      return {
        ...state,
        balance: state.balance + SUBSIDY_AMOUNT,
        stats: { ...state.stats, subsidies: state.stats.subsidies + 1 },
      };

    case 'RESET':
      return createInitialState();

    default:
      return state;
  }
}

export function gameReducer(state, action) {
  const now = Date.now();
  const next = reduce(state, action, now);
  return next === state ? state : syncAchievements(next, now);
}

// ── Нормализация сохранений ───────────────────────────────────────────────

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function deepMerge(base, saved) {
  if (!isPlainObject(saved)) return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(saved)) {
    out[key] = isPlainObject(base[key]) && isPlainObject(value) ? deepMerge(base[key], value) : value;
  }
  return out;
}

export const isValidStoredPlate = (p) =>
  isPlainObject(p) && typeof p.id === 'string' && isValidPlate(p) && Number.isFinite(p.value) && TIER_RANK[p.tier] !== undefined;

/** Приводит сохранённое (возможно, устаревшее или битое) состояние к актуальной схеме. */
export function normalizeState(saved) {
  const base = createInitialState();
  if (!isPlainObject(saved)) return base;

  let state = deepMerge(base, saved);
  state.garage = Array.isArray(saved.garage) ? saved.garage.filter(isValidStoredPlate) : [];
  state.recent = Array.isArray(saved.recent) ? saved.recent.filter((p) => isPlainObject(p) && isValidPlate(p)).slice(0, RECENT_LIMIT) : [];
  state.frames.owned = Array.isArray(saved.frames?.owned) ? saved.frames.owned.filter((id) => FRAME_BY_ID[id]) : ['standard'];
  if (!state.frames.owned.includes('standard')) state.frames.owned.unshift('standard');
  if (!state.frames.owned.includes(state.frames.active)) state.frames.active = 'standard';
  if (!Number.isFinite(state.balance)) state.balance = base.balance;
  if (!Number.isInteger(state.rev)) state.rev = 0;
  if (state.current && !isValidStoredPlate(state.current.plate)) state.current = null;
  if (state.current && !state.current.revealed) state = revealCurrent(state);
  return syncAchievements(state, Date.now());
}
