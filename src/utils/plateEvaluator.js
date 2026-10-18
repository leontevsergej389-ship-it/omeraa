// Чистая логика номеров: генерация, поиск комбинаций, оценка стоимости и тира редкости.
import {
  LETTERS,
  LATIN_TO_CYRILLIC,
  REGIONS,
  REGION_BY_CODE,
  regionCoef,
  SPECIAL_SERIES,
  SPECIAL_ENTRIES,
  SPECIAL_REGIONS,
  NICE_SERIES,
  TRIPLE_LETTERS_TOP,
  TRIPLE_LETTER_NAMES,
  TRIPLE_DIGIT_NAMES,
  TRIPLE_DIGITS_TOP,
  MULTIPLIERS as M,
  COMBO_THRESHOLD,
  BASE_PRICE,
  TIERS,
  RENT_RATES,
  PATTERN_CHANCES,
  VIP_BOOST,
  SPIN_ECONOMY,
} from '../data/platesConfig.js';

export const pad3 = (n) => String(n).padStart(3, '0');

export const plateKey = ({ letters, digits, region }) => `${letters}${digits}${region}`;

/** Человекочитаемая запись номера: «А 001 АА 77». */
export const formatPlate = ({ letters, digits, region }) =>
  `${letters[0]} ${digits} ${letters.slice(1)} ${region}`;

/** Детерминированный псевдослучайный хеш строки в [0, 1) — FNV-1a. */
function hash01(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

/** Приводит ввод пользователя к буквам ГОСТ (латиница → кириллица, верхний регистр). */
export function normalizeLetters(input) {
  return [...String(input).toUpperCase()]
    .map((ch) => LATIN_TO_CYRILLIC[ch] ?? ch)
    .filter((ch) => LETTERS.includes(ch))
    .join('');
}

export function isValidPlate({ letters, digits, region }) {
  return (
    typeof letters === 'string' &&
    letters.length === 3 &&
    [...letters].every((l) => LETTERS.includes(l)) &&
    /^\d{3}$/.test(digits) &&
    digits !== '000' &&
    Boolean(REGION_BY_CODE[region])
  );
}

const isTriple = (s) => s[0] === s[1] && s[1] === s[2];

const LADDERS = ['012', '123', '234', '345', '456', '567', '678', '789', '987', '876', '765', '654', '543', '432', '321', '210'];

/** Буквенная часть: спецсерия региона › блатная серия › три одинаковые › зеркальные. */
export function analyzeLetters(letters, region) {
  const special = SPECIAL_SERIES.find((s) => s.letters === letters && s.regions.includes(region));
  if (special) {
    return { mult: special.mult, tags: [{ id: `special-${letters}${region}`, label: special.label, mult: special.mult, kind: 'special' }] };
  }
  const nice = NICE_SERIES[letters];
  if (nice) {
    return { mult: nice.mult, tags: [{ id: `nice-${letters}`, label: nice.label, mult: nice.mult, kind: 'letters' }] };
  }
  if (isTriple(letters)) {
    const top = Boolean(TRIPLE_LETTERS_TOP[letters[0]]);
    const mult = top ? M.tripleLettersTop : M.tripleLettersOther;
    return { mult, tags: [{ id: `triple-l-${letters[0]}`, label: `Три ${TRIPLE_LETTER_NAMES[letters[0]]}`, mult, kind: 'letters' }] };
  }
  if (letters[0] === letters[2]) {
    return { mult: M.mirrorLetters, tags: [{ id: 'mirror-l', label: 'Зеркальные буквы', mult: M.mirrorLetters, kind: 'letters' }] };
  }
  return { mult: 1, tags: [] };
}

/** Цифровая часть: тройные › первая десятка › ровные сотни › зеркальные › лесенка; бинго суммируется сверху. */
export function analyzeDigits(digits, region) {
  const n = Number(digits);
  const tags = [];
  let mult = 1;
  const add = (tag) => {
    tags.push(tag);
    mult *= tag.mult;
  };

  if (isTriple(digits)) {
    const top = TRIPLE_DIGITS_TOP.includes(digits);
    add({ id: `triple-d-${digits}`, label: `${TRIPLE_DIGIT_NAMES[digits]} ${digits}`, mult: top ? M.tripleDigitsTop : M.tripleDigitsOther, kind: 'digits' });
  } else if (n >= 1 && n <= 9) {
    if (n === 1) add({ id: 'first-001', label: 'Номер Первый', mult: M.first001, kind: 'digits' });
    else if (n === 7) add({ id: 'first-007', label: 'Агент 007', mult: M.first007, kind: 'digits' });
    else add({ id: `first-${digits}`, label: `Первая десятка ${digits}`, mult: M.firstOther, kind: 'digits' });
  } else if (n % 100 === 0) {
    add({ id: `round-${digits}`, label: `Ровная сотня ${digits}`, mult: M.roundHundred, kind: 'digits' });
  } else if (digits[0] === digits[2]) {
    add({ id: 'mirror-d', label: `Зеркальные цифры ${digits}`, mult: M.mirrorDigits, kind: 'digits' });
  } else if (LADDERS.includes(digits)) {
    add({ id: 'ladder', label: `Лесенка ${digits}`, mult: M.ladder, kind: 'digits' });
  }

  const bingo = digits === pad3(Number(region));
  if (bingo) add({ id: 'bingo', label: `Бинго! Цифры = регион ${region}`, mult: M.bingo, kind: 'bingo' });

  return { mult, tags, bingo };
}

export function getTier(value) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (value >= TIERS[i].min) return TIERS[i].id;
  }
  return 'common';
}

/** Полная оценка номера. Детерминирована: один и тот же номер всегда стоит одинаково. */
export function evaluatePlate({ letters, digits, region }) {
  const basePrice = BASE_PRICE.min + (BASE_PRICE.max - BASE_PRICE.min) * hash01(`${letters}|${digits}|${region}`);
  const coef = regionCoef(region);
  const L = analyzeLetters(letters, region);
  const D = analyzeDigits(digits, region);
  const combo = L.mult >= COMBO_THRESHOLD && D.mult >= COMBO_THRESHOLD ? M.combo : 1;

  const tags = [...L.tags, ...D.tags];
  if (combo > 1) tags.push({ id: 'combo', label: 'Блатной комплект', mult: combo, kind: 'combo' });
  if (coef >= 1.1) tags.push({ id: `region-${region}`, label: `Престижный регион ${region}`, mult: coef, kind: 'region' });

  const multiplier = L.mult * D.mult * combo;
  const value = Math.max(10, Math.round((basePrice * coef * multiplier) / 10) * 10);

  return {
    basePrice: Math.round(basePrice),
    regionCoef: coef,
    letterMult: L.mult,
    digitMult: D.mult,
    combo: combo > 1,
    bingo: D.bingo,
    multiplier,
    value,
    tier: getTier(value),
    tags,
  };
}

/**
 * Итоговые вероятности «подкрутки» паттернов с учётом удачи, VIP и выбранного региона.
 * Возвращает долю для каждого паттерна; оставшаяся вероятность — честный случайный номер.
 */
export function computeChances({ luck = 1, vip = false, targetRegion = '' } = {}) {
  const c = {};
  for (const key of Object.keys(PATTERN_CHANCES)) {
    c[key] = PATTERN_CHANCES[key] * luck * (vip ? VIP_BOOST[key] : 1);
  }
  if (targetRegion) {
    if (SPECIAL_REGIONS.includes(targetRegion)) {
      c.special *= 2;
    } else {
      c.nice += c.special;
      c.special = 0;
    }
  }
  const cap = (keys, max) => {
    const sum = keys.reduce((s, k) => s + c[k], 0);
    if (sum > max) keys.forEach((k) => (c[k] = (c[k] / sum) * max));
  };
  cap(['special', 'nice', 'tripleLetters'], 0.6);
  cap(['firstTen', 'tripleDigits', 'bingo', 'round', 'ladder'], 0.6);
  return c;
}

const FIRST_TEN_WEIGHTS = [
  ['001', 0.6], ['002', 1], ['003', 1], ['004', 1], ['005', 1], ['006', 1], ['007', 0.8], ['008', 1], ['009', 1],
];

function pickWeighted(pairs, rng) {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of pairs) {
    if ((r -= w) < 0) return v;
  }
  return pairs[pairs.length - 1][0];
}

/** Генерирует сырой номер { letters, digits, region }. */
export function generateRawPlate({ luck = 1, vip = false, targetRegion = '', rng = Math.random } = {}) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const ch = computeChances({ luck, vip, targetRegion });

  let region = targetRegion && REGION_BY_CODE[targetRegion] ? targetRegion : pick(REGIONS).code;
  let letters;

  let r = rng();
  if (r < ch.special) {
    const pool = targetRegion ? SPECIAL_ENTRIES.filter((e) => e.region === targetRegion) : SPECIAL_ENTRIES;
    const entry = pick(pool.length ? pool : SPECIAL_ENTRIES);
    letters = entry.letters;
    region = entry.region;
  } else if ((r -= ch.special) < ch.nice) {
    letters = pick(Object.keys(NICE_SERIES));
  } else if ((r -= ch.nice) < ch.tripleLetters) {
    const l = pick(LETTERS);
    letters = l + l + l;
  } else {
    letters = pick(LETTERS) + pick(LETTERS) + pick(LETTERS);
  }

  let digits;
  r = rng();
  if (r < ch.firstTen) {
    digits = pickWeighted(FIRST_TEN_WEIGHTS, rng);
  } else if ((r -= ch.firstTen) < ch.tripleDigits) {
    const d = 1 + Math.floor(rng() * 9);
    digits = `${d}${d}${d}`;
  } else if ((r -= ch.tripleDigits) < ch.bingo) {
    digits = pad3(Number(region));
  } else if ((r -= ch.bingo) < ch.round) {
    digits = `${1 + Math.floor(rng() * 9)}00`;
  } else if ((r -= ch.round) < ch.ladder) {
    digits = pick(LADDERS);
  } else {
    digits = pad3(1 + Math.floor(rng() * 999));
  }

  return { letters, digits, region };
}

let idCounter = 0;
const makeId = () => `${Date.now().toString(36)}-${(idCounter++).toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

/** Собирает полноценный объект номера с оценкой. */
export function buildPlate(raw, extra = {}) {
  return { id: makeId(), ...raw, ...evaluatePlate(raw), createdAt: Date.now(), locked: false, ...extra };
}

export function generatePlate(opts = {}) {
  return buildPlate(generateRawPlate(opts), { vip: Boolean(opts.vip) });
}

/** Случайные символы для анимации прокрутки. */
export const randomLetter = (rng = Math.random) => LETTERS[Math.floor(rng() * LETTERS.length)];
export const randomDigit = (rng = Math.random) => String(Math.floor(rng() * 10));
export const randomRegionCode = (rng = Math.random) => REGIONS[Math.floor(rng() * REGIONS.length)].code;

/** Стоимость одного прокрута (госпошлина). */
export function computeSpinCost({ targetRegion = '', vip = false, discount = 1 } = {}) {
  let cost = SPIN_ECONOMY.baseCost;
  if (targetRegion) cost *= 1 + 0.6 * regionCoef(targetRegion);
  if (vip) cost *= SPIN_ECONOMY.vipCostMult;
  return Math.round((cost * discount) / 10) * 10;
}

export const salePrice = (plate, saleMult = 1) => Math.round(plate.value * saleMult);

export const baseRent = (plate) => plate.value * (RENT_RATES[plate.tier] ?? 0);
