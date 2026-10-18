// Достижения и коллекции.
import { LETTERS, SUBJECTS, NICE_SERIES, SPECIAL_ENTRIES, regionName } from './platesConfig.js';

const isTriple = (s) => s[0] === s[1] && s[1] === s[2];
const codesOf = (name) => SUBJECTS.find((s) => s.name === name).codes;

/**
 * Коллекции: keyOf(plate) возвращает ключ элемента коллекции или null.
 * Найденные элементы запоминаются навсегда — даже если номер потом продан.
 */
export const COLLECTIONS = [
  {
    id: 'moscow',
    name: 'Белокаменная',
    description: 'Номера всех кодов Москвы',
    icon: 'Landmark',
    items: codesOf('Москва'),
    keyOf: (p) => p.region,
    reward: 60000,
  },
  {
    id: 'spb',
    name: 'Северная столица',
    description: 'Все коды Санкт-Петербурга',
    icon: 'Anchor',
    items: codesOf('Санкт-Петербург'),
    keyOf: (p) => p.region,
    reward: 20000,
  },
  {
    id: 'mo',
    name: 'Подмосковье',
    description: 'Все коды Московской области',
    icon: 'Trees',
    items: codesOf('Московская область'),
    keyOf: (p) => p.region,
    reward: 30000,
  },
  {
    id: 'caucasus',
    name: 'Кавказский транзит',
    description: 'Номера республик Северного Кавказа и Ставрополья',
    icon: 'Mountain',
    items: ['05', '06', '07', '09', '15', '26', '95'],
    keyOf: (p) => p.region,
    reward: 40000,
  },
  {
    id: 'tripleLetters',
    name: 'Тройные буквы',
    description: 'Все 12 серий из трёх одинаковых букв',
    icon: 'Type',
    items: LETTERS.map((l) => l + l + l),
    keyOf: (p) => (isTriple(p.letters) ? p.letters : null),
    reward: 250000,
  },
  {
    id: 'tripleDigits',
    name: 'Топоры и компания',
    description: 'Все тройные цифры от 111 до 999',
    icon: 'Axe',
    items: ['111', '222', '333', '444', '555', '666', '777', '888', '999'],
    keyOf: (p) => (isTriple(p.digits) ? p.digits : null),
    reward: 120000,
  },
  {
    id: 'firstTen',
    name: 'Первая десятка',
    description: 'Все номера от 001 до 009',
    icon: 'Medal',
    items: ['001', '002', '003', '004', '005', '006', '007', '008', '009'],
    keyOf: (p) => (Number(p.digits) <= 9 ? p.digits : null),
    reward: 120000,
  },
  {
    id: 'round',
    name: 'Ровные сотни',
    description: 'От 100 до 900',
    icon: 'CircleDollarSign',
    items: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    keyOf: (p) => (Number(p.digits) % 100 === 0 ? p.digits : null),
    reward: 60000,
  },
  {
    id: 'nice',
    name: 'Блатные серии',
    description: 'Все общие красивые серии букв',
    icon: 'Flame',
    items: Object.keys(NICE_SERIES),
    keyOf: (p) => (NICE_SERIES[p.letters] ? p.letters : null),
    reward: 150000,
  },
  {
    id: 'special',
    name: 'Спецсерии регионов',
    description: 'Все региональные спецсерии: АМР, ЕКХ, СКР, КРА и другие',
    icon: 'Siren',
    items: SPECIAL_ENTRIES.map((e) => e.key),
    keyOf: (p) => SPECIAL_ENTRIES.find((e) => e.letters === p.letters && e.region === p.region)?.key ?? null,
    reward: 2000000,
  },
  {
    id: 'subjects',
    name: 'Вся Россия',
    description: 'Номера всех субъектов РФ из справочника',
    icon: 'Map',
    items: SUBJECTS.map((s) => s.name),
    keyOf: (p) => regionName(p.region),
    reward: 750000,
    compact: true,
  },
];

export const COLLECTION_BY_ID = Object.fromEntries(COLLECTIONS.map((c) => [c.id, c]));

const found = (ctx, collection, key) => (ctx.state.discovered[collection]?.[key] ? 1 : 0);
const foundAny = (ctx, collection, keys) => (keys.some((k) => ctx.state.discovered[collection]?.[k]) ? 1 : 0);
const foundCount = (ctx, collection) => Object.keys(ctx.state.discovered[collection] ?? {}).length;
const sumUpgrades = (ctx) => Object.values(ctx.state.upgrades).reduce((a, b) => a + b, 0);

/**
 * Достижения: progress(ctx) → [текущее, цель]. ctx = { state, income, garageValue, capacity }.
 */
export const ACHIEVEMENTS = [
  { id: 'spin1', name: 'Первый номер', description: 'Сделайте первый прокрут', icon: 'Dices', reward: 500, progress: (c) => [c.state.stats.spins, 1] },
  { id: 'spin100', name: 'Завсегдатай МРЭО', description: '100 прокрутов', icon: 'Dices', reward: 10000, progress: (c) => [c.state.stats.spins, 100] },
  { id: 'spin1000', name: 'Свой человек в окошке', description: '1 000 прокрутов', icon: 'Dices', reward: 75000, progress: (c) => [c.state.stats.spins, 1000] },
  { id: 'spin10000', name: 'Легенда очереди', description: '10 000 прокрутов', icon: 'Dices', reward: 750000, progress: (c) => [c.state.stats.spins, 10000] },

  { id: 'tierUncommon', name: 'Уже неплохо', description: 'Выбейте необычный номер', icon: 'Sparkle', reward: 2000, progress: (c) => [c.state.stats.tierCounts.uncommon, 1] },
  { id: 'tierRare', name: 'Редкая находка', description: 'Выбейте редкий номер', icon: 'Gem', reward: 8000, progress: (c) => [c.state.stats.tierCounts.rare, 1] },
  { id: 'tierEpic', name: 'Эпичный улов', description: 'Выбейте эпический номер', icon: 'Sparkles', reward: 35000, progress: (c) => [c.state.stats.tierCounts.epic, 1] },
  { id: 'tierLegendary', name: 'Легенда дорог', description: 'Выбейте легендарный номер', icon: 'Crown', reward: 150000, progress: (c) => [c.state.stats.tierCounts.legendary, 1] },
  { id: 'legendary10', name: 'Коллекционер легенд', description: '10 легендарных номеров', icon: 'Crown', reward: 1000000, progress: (c) => [c.state.stats.tierCounts.legendary, 10] },

  { id: 'agent007', name: 'Агент 007', description: 'Выбейте номер 007', icon: 'Target', reward: 10000, progress: (c) => [found(c, 'firstTen', '007'), 1] },
  { id: 'number1', name: 'Номер Первый', description: 'Выбейте номер 001', icon: 'Medal', reward: 15000, progress: (c) => [found(c, 'firstTen', '001'), 1] },
  { id: 'axes', name: 'Топоры', description: 'Выбейте цифры 777', icon: 'Axe', reward: 12000, progress: (c) => [found(c, 'tripleDigits', '777'), 1] },
  { id: 'bingo', name: 'Бинго!', description: 'Цифры номера совпали с кодом региона', icon: 'PartyPopper', reward: 10000, progress: (c) => [c.state.stats.bingo, 1] },
  { id: 'combo', name: 'Блатной комплект', description: 'Козырные буквы и козырные цифры на одном номере', icon: 'Flame', reward: 100000, progress: (c) => [c.state.stats.combo, 1] },
  { id: 'fso', name: 'ФСО на связи', description: 'Выбейте серию ЕКХ 77 или ЕКХ 97', icon: 'ShieldCheck', reward: 100000, progress: (c) => [foundAny(c, 'special', ['ЕКХ77', 'ЕКХ97']), 1] },
  { id: 'amr', name: 'Мигалки и спецсвязь', description: 'Выбейте серию АМР 97', icon: 'Siren', reward: 150000, progress: (c) => [found(c, 'special', 'АМР97'), 1] },
  { id: 'skr', name: 'Следствие ведут…', description: 'Выбейте серию СКР 77 или СКР 97', icon: 'Search', reward: 80000, progress: (c) => [foundAny(c, 'special', ['СКР77', 'СКР97']), 1] },
  { id: 'kra', name: 'Элита 95', description: 'Выбейте серию КРА 95', icon: 'Mountain', reward: 80000, progress: (c) => [found(c, 'special', 'КРА95'), 1] },

  { id: 'rich100k', name: 'Первая сотка', description: 'Накопите 100 000 ₽', icon: 'Wallet', reward: 5000, progress: (c) => [c.state.balance, 100000] },
  { id: 'millionaire', name: 'Миллионер', description: 'Накопите 1 000 000 ₽', icon: 'Banknote', reward: 50000, progress: (c) => [c.state.balance, 1000000] },
  { id: 'multimillionaire', name: 'Мультимиллионер', description: 'Накопите 10 000 000 ₽', icon: 'Banknote', reward: 300000, progress: (c) => [c.state.balance, 10000000] },
  { id: 'oligarch', name: 'Олигарх', description: 'Накопите 100 000 000 ₽', icon: 'Crown', reward: 2000000, progress: (c) => [c.state.balance, 100000000] },
  { id: 'fleet1m', name: 'Автопарк на миллион', description: 'Стоимость гаража от 1 000 000 ₽', icon: 'CarFront', reward: 50000, progress: (c) => [c.garageValue, 1000000] },
  { id: 'fleet25m', name: 'Автопарк мечты', description: 'Стоимость гаража от 25 000 000 ₽', icon: 'CarFront', reward: 1000000, progress: (c) => [c.garageValue, 25000000] },

  { id: 'seller100', name: 'Барыга', description: 'Продайте 100 номеров', icon: 'HandCoins', reward: 10000, progress: (c) => [c.state.stats.sold, 100] },
  { id: 'seller1000', name: 'Оптовик', description: 'Продайте 1 000 номеров', icon: 'HandCoins', reward: 100000, progress: (c) => [c.state.stats.sold, 1000] },
  { id: 'rentier', name: 'Рантье', description: 'Пассивный доход от 100 ₽/сек', icon: 'TrendingUp', reward: 25000, progress: (c) => [c.income, 100] },
  { id: 'tycoon', name: 'Арендный магнат', description: 'Пассивный доход от 1 000 ₽/сек', icon: 'TrendingUp', reward: 250000, progress: (c) => [c.income, 1000] },
  { id: 'fullGarage', name: 'Битком', description: 'Заполните гараж полностью', icon: 'Warehouse', reward: 5000, progress: (c) => [c.state.garage.length, c.capacity] },
  { id: 'vip50', name: 'VIP-клиент', description: 'Сделайте 50 VIP-прокрутов', icon: 'Star', reward: 25000, progress: (c) => [c.state.stats.vipSpins, 50] },
  { id: 'tourist', name: 'Путешественник', description: 'Номера из 25 разных субъектов РФ', icon: 'MapPin', reward: 20000, progress: (c) => [foundCount(c, 'subjects'), 25] },
  { id: 'pumped', name: 'Прокачанный', description: 'Купите 25 уровней улучшений', icon: 'Rocket', reward: 100000, progress: (c) => [sumUpgrades(c), 25] },
  { id: 'stylist', name: 'Стиляга', description: 'Купите любую рамку в магазине', icon: 'Frame', reward: 10000, progress: (c) => [c.state.frames.owned.length - 1, 1] },
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
