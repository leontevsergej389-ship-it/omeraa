// Производные значения игрового состояния: модификаторы, доход, стоимость прокрута.
import { SPIN_ECONOMY, TIER_RANK } from '../data/platesConfig.js';
import { UPGRADE_BY_ID, FRAME_BY_ID, AUTO_SPIN_DELAY } from '../data/shopConfig.js';
import { baseRent, computeSpinCost } from '../utils/plateEvaluator.js';

export const isBoosterActive = (state, id, now = Date.now()) => (state.boosters[id] ?? 0) > now;

export const boosterRemaining = (state, id, now = Date.now()) => Math.max(0, ((state.boosters[id] ?? 0) - now) / 1000);

export const getLuck = (state, now) =>
  (1 + UPGRADE_BY_ID.luck.perLevel * state.upgrades.luck) * (isBoosterActive(state, 'luck', now) ? 2 : 1);

export const getSaleMult = (state, now) =>
  1 +
  UPGRADE_BY_ID.appraisal.perLevel * state.upgrades.appraisal +
  (FRAME_BY_ID[state.frames.active]?.saleBonus ?? 0) +
  (isBoosterActive(state, 'sale', now) ? 0.5 : 0);

export const getRentMult = (state, now) =>
  (1 + UPGRADE_BY_ID.rent.perLevel * state.upgrades.rent) * (isBoosterActive(state, 'rent', now) ? 3 : 1);

export const getCapacity = (state) => SPIN_ECONOMY.startGarage + UPGRADE_BY_ID.garage.perLevel * state.upgrades.garage;

export const getGarageValue = (state) => state.garage.reduce((sum, p) => sum + p.value, 0);

export const getPlateRent = (state, plate, now) => baseRent(plate) * getRentMult(state, now);

export const getIncomePerSec = (state, now) => {
  const mult = getRentMult(state, now);
  return state.garage.reduce((sum, p) => sum + baseRent(p), 0) * mult;
};

export const getSpinCost = (state, now) =>
  computeSpinCost({
    targetRegion: state.settings.targetRegion,
    vip: state.settings.vip,
    discount: isBoosterActive(state, 'discount', now) ? 0.5 : 1,
  });

export const getAutoDelay = (state) => {
  const base = state.settings.fastSpin ? AUTO_SPIN_DELAY.fast : AUTO_SPIN_DELAY.normal;
  return Math.round(base * (1 - UPGRADE_BY_ID.conveyor.perLevel * state.upgrades.conveyor));
};

export const isAtLeast = (tier, minTier) => TIER_RANK[tier] >= TIER_RANK[minTier];

/** Контекст для проверки достижений. */
export const achievementContext = (state, now) => ({
  state,
  income: getIncomePerSec(state, now),
  garageValue: getGarageValue(state),
  capacity: getCapacity(state),
});
