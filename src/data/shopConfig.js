// Магазин МРЭО: постоянные улучшения, временные бустеры и рамки.

export const UPGRADES = [
  {
    id: 'luck',
    name: 'Связи в МРЭО',
    icon: 'Handshake',
    description: 'Знакомый инспектор «придерживает» красивые серии. Повышает шанс спецсерий, блатных букв и красивых цифр.',
    baseCost: 15000,
    growth: 1.6,
    maxLevel: 20,
    perLevel: 0.12,
    format: (lvl) => `×${(1 + 0.12 * lvl).toFixed(2)} к шансам`,
  },
  {
    id: 'appraisal',
    name: 'Оценка перекупов',
    icon: 'HandCoins',
    description: 'Свои люди на авторынке дают больше за каждый проданный номер.',
    baseCost: 10000,
    growth: 1.55,
    maxLevel: 25,
    perLevel: 0.05,
    format: (lvl) => `+${Math.round(5 * lvl)}% к цене продажи`,
  },
  {
    id: 'garage',
    name: 'Расширение гаража',
    icon: 'Warehouse',
    description: 'Арендуете ещё один бокс в ГСК. Больше мест для коллекции.',
    baseCost: 8000,
    growth: 1.5,
    maxLevel: 20,
    perLevel: 10,
    format: (lvl) => `${20 + 10 * lvl} мест`,
  },
  {
    id: 'rent',
    name: 'Агентство аренды',
    icon: 'Building',
    description: 'Сдаёте красивые номера на свадьбы и клипы. Увеличивает пассивный доход от Rare+ номеров.',
    baseCost: 25000,
    growth: 1.6,
    maxLevel: 20,
    perLevel: 0.2,
    format: (lvl) => `+${Math.round(20 * lvl)}% к аренде`,
  },
  {
    id: 'conveyor',
    name: 'Электронная очередь',
    icon: 'Gauge',
    description: 'Без очередей и бумажек: авто-прокрут работает быстрее.',
    baseCost: 20000,
    growth: 1.8,
    maxLevel: 10,
    perLevel: 0.08,
    format: (lvl) => `−${Math.round(8 * lvl)}% к паузе авто-прокрута`,
  },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export const upgradeCost = (upgrade, level) => Math.round((upgrade.baseCost * upgrade.growth ** level) / 100) * 100;

export const BOOSTERS = [
  {
    id: 'luck',
    name: 'Конверт инспектору',
    icon: 'Mail',
    description: 'Удача ×2 на все паттерны.',
    cost: 30000,
    duration: 60,
  },
  {
    id: 'sale',
    name: 'Ярмарка номеров',
    icon: 'Percent',
    description: '+50% к цене продажи номеров.',
    cost: 40000,
    duration: 90,
  },
  {
    id: 'rent',
    name: 'Сезон свадеб',
    icon: 'Heart',
    description: 'Аренда номеров приносит ×3.',
    cost: 60000,
    duration: 120,
  },
  {
    id: 'discount',
    name: 'Льгота по госпошлине',
    icon: 'BadgePercent',
    description: 'Прокрут стоит вдвое дешевле.',
    cost: 20000,
    duration: 60,
  },
];

export const BOOSTER_BY_ID = Object.fromEntries(BOOSTERS.map((b) => [b.id, b]));

export const FRAMES = [
  { id: 'standard', name: 'Обычная чёрная', cost: 0, saleBonus: 0, description: 'Простая пластиковая рамка из любого автомагазина.' },
  { id: 'carbon', name: 'Карбон', cost: 50000, saleBonus: 0.03, description: 'Плетёный карбон — для тех, кто в теме. +3% к продаже.' },
  { id: 'gold', name: 'Золотая', cost: 250000, saleBonus: 0.07, description: 'Полированное «золото» с гравировкой. +7% к продаже.' },
  { id: 'fso', name: 'ФСО', cost: 1000000, saleBonus: 0.12, description: 'Строгая рамка со стробоскопами. +12% к продаже.' },
];

export const FRAME_BY_ID = Object.fromEntries(FRAMES.map((f) => [f.id, f]));

/** Базовая пауза между прокрутами в авто-режиме (мс), без учёта анимации. */
export const AUTO_SPIN_DELAY = { normal: 650, fast: 260 };
