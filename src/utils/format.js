// Форматирование денег и чисел.

const nf = new Intl.NumberFormat('ru-RU');

/** 1234567 → «1 234 567 ₽» */
export const money = (value) => `${nf.format(Math.floor(value))} ₽`;

/** Компактная запись для шапки: 1,2 млн ₽ / 15,4 тыс ₽ */
export function moneyShort(value) {
  const v = Math.floor(value);
  const abs = Math.abs(v);
  const fmt = (n, unit) => `${n.toLocaleString('ru-RU', { maximumFractionDigits: n < 10 ? 2 : 1 })} ${unit} ₽`;
  if (abs >= 1e9) return fmt(v / 1e9, 'млрд');
  if (abs >= 1e6) return fmt(v / 1e6, 'млн');
  if (abs >= 1e5) return fmt(v / 1e3, 'тыс');
  return money(v);
}

/** Доход в секунду: до 10 ₽ показываем десятые. */
export const perSecond = (value) =>
  `${value.toLocaleString('ru-RU', { maximumFractionDigits: value < 10 ? 1 : 0 })} ₽/сек`;

export const percent = (value, digits = 2) =>
  `${(value * 100).toLocaleString('ru-RU', { maximumFractionDigits: digits })}%`;

export const multiplier = (value) => `×${Number(value.toFixed(2)).toLocaleString('ru-RU')}`;

/** Секунды → «1:05» */
export const timer = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Склонение: plural(5, ['номер', 'номера', 'номеров']) */
export function plural(n, forms) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
