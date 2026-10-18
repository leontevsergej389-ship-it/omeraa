import { useMemo, useState } from 'react';
import { ArrowDownWideNarrow, Dices, HandCoins, Lock, LockOpen, MapPin, Search, TrendingUp, Warehouse, Wallet } from 'lucide-react';
import LicensePlate from './LicensePlate.jsx';
import { Button, Card, Modal, RarityBadge, StatTile, TagChip } from './ui.jsx';
import { FRAMES, FRAME_BY_ID } from '../data/shopConfig.js';
import { LATIN_TO_CYRILLIC, regionName, TIERS, TIER_BY_ID, TIER_RANK } from '../data/platesConfig.js';
import { formatPlate, salePrice } from '../utils/plateEvaluator.js';
import { getCapacity, getGarageValue, getIncomePerSec, getPlateRent, getSaleMult } from '../state/selectors.js';
import { sound } from '../utils/soundEngine.js';
import { money, moneyShort, multiplier, perSecond, plural } from '../utils/format.js';

const SORTS = {
  priceDesc: { label: 'Сначала дорогие', fn: (a, b) => b.value - a.value },
  priceAsc: { label: 'Сначала дешёвые', fn: (a, b) => a.value - b.value },
  newest: { label: 'Сначала новые', fn: (a, b) => b.createdAt - a.createdAt },
  oldest: { label: 'Сначала старые', fn: (a, b) => a.createdAt - b.createdAt },
  region: { label: 'По региону', fn: (a, b) => Number(a.region) - Number(b.region) || b.value - a.value },
};

/** «a777aa» → «А777АА»: латиница превращается в буквы ГОСТ, чтобы искать с любой раскладки. */
const normalizeQuery = (q) =>
  [...q.toUpperCase()]
    .map((ch) => LATIN_TO_CYRILLIC[ch] ?? ch)
    .join('')
    .replace(/\s+/g, '');

function PlateDetails({ plate, state, dispatch, onClose }) {
  const [preview, setPreview] = useState(null);
  if (!plate) return null;
  const now = Date.now();
  const saleMult = getSaleMult(state, now);
  const frame = preview ?? state.frames.active;
  const rows = [
    ['Базовая цена', money(plate.basePrice)],
    [`Регион ${plate.region}`, multiplier(plate.regionCoef)],
    ['Буквы', multiplier(plate.letterMult)],
    ['Цифры', multiplier(plate.digitMult)],
    ...(plate.combo ? [['Блатной комплект', multiplier(2)]] : []),
  ];

  const sell = () => {
    dispatch({ type: 'SELL_PLATE', id: plate.id });
    sound.coin(1 + TIER_RANK[plate.tier]);
    onClose();
  };

  return (
    <div className="space-y-4">
      <LicensePlate letters={plate.letters} digits={plate.digits} region={plate.region} tier={plate.tier} frame={frame} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RarityBadge tier={plate.tier} />
        <span className={`font-display text-2xl font-bold ${plate.tier === 'legendary' ? 'text-shimmer' : TIER_BY_ID[plate.tier].text}`}>
          {money(plate.value)}
        </span>
      </div>
      <div className="text-sm text-zinc-400">
        <MapPin className="mr-1 inline h-4 w-4" />
        {regionName(plate.region)} · получен {new Date(plate.createdAt).toLocaleString('ru-RU')}
      </div>
      {plate.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {plate.tags.map((t) => (
            <TagChip key={t.id} tag={t} />
          ))}
        </div>
      )}
      <div className="rounded-xl bg-zinc-800/50 p-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between py-0.5 text-zinc-400">
            <span>{k}</span>
            <span className="text-zinc-200">{v}</span>
          </div>
        ))}
        <div className="mt-1 flex justify-between border-t border-white/10 pt-1.5 font-semibold">
          <span>Итог ×{Number(plate.multiplier.toFixed(2)).toLocaleString('ru-RU')}</span>
          <span>{money(plate.value)}</span>
        </div>
        {TIER_RANK[plate.tier] >= TIER_RANK.rare && (
          <div className="mt-1 flex justify-between text-emerald-400">
            <span>Аренда</span>
            <span>+{perSecond(getPlateRent(state, plate, now))}</span>
          </div>
        )}
      </div>
      <div>
        <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Примерить рамку</div>
        <div className="flex flex-wrap gap-2">
          {FRAMES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setPreview(f.id)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs ${frame === f.id ? 'border-sky-400 bg-sky-500/15 text-sky-200' : 'border-white/10 text-zinc-400'}`}
            >
              {!state.frames.owned.includes(f.id) && <Lock className="h-3 w-3" />}
              {f.name}
            </button>
          ))}
        </div>
        {preview && !state.frames.owned.includes(preview) && (
          <p className="mt-2 text-xs text-amber-300">Рамка «{FRAME_BY_ID[preview].name}» — только примерка. Купить можно в Магазине МРЭО.</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="ghost" onClick={() => dispatch({ type: 'TOGGLE_LOCK', id: plate.id })}>
          {plate.locked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          {plate.locked ? 'Снять замок' : 'Закрепить'}
        </Button>
        <Button variant="success" onClick={sell} disabled={plate.locked}>
          <HandCoins className="h-4 w-4" /> {money(salePrice(plate, saleMult))}
        </Button>
      </div>
    </div>
  );
}

export default function Garage({ state, dispatch, notify, onNavigate }) {
  const [query, setQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [sort, setSort] = useState('priceDesc');
  const [openId, setOpenId] = useState(null);

  const now = Date.now();
  const saleMult = getSaleMult(state, now);
  const capacity = getCapacity(state);
  const garageValue = getGarageValue(state);
  const income = getIncomePerSec(state, now);

  const counts = useMemo(() => {
    const c = Object.fromEntries(TIERS.map((t) => [t.id, 0]));
    state.garage.forEach((p) => c[p.tier]++);
    return c;
  }, [state.garage]);

  const visible = useMemo(() => {
    const q = normalizeQuery(query);
    return state.garage
      .filter((p) => tierFilter === 'all' || p.tier === tierFilter)
      .filter((p) => {
        if (!q) return true;
        const compact = `${p.letters[0]}${p.digits}${p.letters.slice(1)}${p.region}`;
        return compact.includes(q) || p.letters.includes(q) || regionName(p.region).toUpperCase().includes(q);
      })
      .sort(SORTS[sort].fn);
  }, [state.garage, query, tierFilter, sort]);

  const bulk = (tiers) => {
    const list = state.garage.filter((p) => !p.locked && tiers.includes(p.tier));
    return { count: list.length, sum: list.reduce((s, p) => s + salePrice(p, saleMult), 0) };
  };
  const commons = bulk(['common']);
  const uncommons = bulk(['uncommon']);

  const sellMany = (tiers, info) => {
    if (!info.count) return;
    dispatch({ type: 'SELL_MANY', tiers });
    sound.coin(Math.min(6, 1 + Math.floor(info.count / 5)));
    notify({ kind: 'success', title: `Продано ${info.count} ${plural(info.count, ['номер', 'номера', 'номеров'])}`, text: `+${money(info.sum)}` });
  };

  const sellOne = (p) => {
    dispatch({ type: 'SELL_PLATE', id: p.id });
    sound.coin(1 + TIER_RANK[p.tier]);
  };

  const openPlate = state.garage.find((p) => p.id === openId);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={Warehouse} label="Места" value={`${state.garage.length} / ${capacity}`} sub={state.garage.length >= capacity ? 'Гараж заполнен' : `свободно ${capacity - state.garage.length}`} />
        <StatTile icon={Wallet} label="Стоимость парка" value={moneyShort(garageValue)} sub={money(garageValue)} accent="text-amber-400" />
        <StatTile icon={TrendingUp} label="Аренда" value={perSecond(income)} sub="Rare, Epic и Legendary" accent="text-emerald-400" />
        <StatTile icon={HandCoins} label="Цена продажи" value={`×${saleMult.toFixed(2)}`} sub="перекупы, рамка, бустеры" accent="text-fuchsia-400" />
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск: А777АА, 777, 97, Москва…"
              className="h-10 w-full rounded-xl border border-white/10 bg-zinc-800 pl-9 pr-3 text-sm outline-none focus:border-sky-400"
            />
          </div>
          <div className="relative">
            <ArrowDownWideNarrow className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/10 bg-zinc-800 pl-9 pr-3 text-sm outline-none focus:border-sky-400 md:w-56"
            >
              {Object.entries(SORTS).map(([id, s]) => (
                <option key={id} value={id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          <FilterChip active={tierFilter === 'all'} onClick={() => setTierFilter('all')}>
            Все · {state.garage.length}
          </FilterChip>
          {TIERS.map((t) => (
            <FilterChip key={t.id} active={tierFilter === t.id} onClick={() => setTierFilter(t.id)} tier={t}>
              {t.name} · {counts[t.id]}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="success" size="sm" disabled={!commons.count} onClick={() => sellMany(['common'], commons)}>
            <HandCoins className="h-4 w-4" /> Продать все незакреплённые обычные ({commons.count}) · {money(commons.sum)}
          </Button>
          <Button variant="ghost" size="sm" disabled={!uncommons.count} onClick={() => sellMany(['uncommon'], uncommons)}>
            Продать необычные ({uncommons.count}) · {money(uncommons.sum)}
          </Button>
        </div>
      </Card>

      {state.garage.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Warehouse className="h-12 w-12 text-zinc-600" />
          <p className="text-zinc-400">Гараж пуст. Выбейте красивый номер и поставьте его сюда.</p>
          <Button variant="primary" onClick={() => onNavigate('generator')}>
            <Dices className="h-4 w-4" /> К генератору
          </Button>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-8 text-center text-zinc-500">Ничего не найдено по заданным фильтрам.</Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((p) => {
            const t = TIER_BY_ID[p.tier];
            const rent = getPlateRent(state, p, now);
            return (
              <div key={p.id} className={`group rounded-2xl border bg-zinc-900/70 p-3 transition hover:bg-zinc-900 ${t.border}`}>
                <button type="button" className="block w-full" onClick={() => setOpenId(p.id)} title="Подробнее">
                  <LicensePlate letters={p.letters} digits={p.digits} region={p.region} tier={p.tier} frame={state.frames.active} glow={t.rank >= 3} />
                </button>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <RarityBadge tier={p.tier} size="sm" />
                  <span className={`font-display font-semibold ${p.tier === 'legendary' ? 'text-shimmer' : t.text}`}>{money(p.value)}</span>
                </div>
                <div className="mt-1 flex min-h-4 items-center justify-between text-[11px] text-zinc-500">
                  <span className="truncate">{p.tags[0]?.label ?? regionName(p.region)}</span>
                  {rent > 0 && <span className="whitespace-nowrap text-emerald-400">+{perSecond(rent)}</span>}
                </div>
                <div className="mt-2 grid grid-cols-[auto_1fr] gap-2">
                  <Button
                    variant={p.locked ? 'gold' : 'subtle'}
                    size="sm"
                    onClick={() => dispatch({ type: 'TOGGLE_LOCK', id: p.id })}
                    title={p.locked ? 'Снять замок' : 'Закрепить от случайной продажи'}
                    aria-label={p.locked ? 'Снять замок' : 'Закрепить'}
                  >
                    {p.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                  </Button>
                  <Button variant="success" size="sm" disabled={p.locked} onClick={() => sellOne(p)}>
                    Продать · {money(salePrice(p, saleMult))}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={Boolean(openPlate)} onClose={() => setOpenId(null)} title={openPlate ? formatPlate(openPlate) : ''}>
        <PlateDetails plate={openPlate} state={state} dispatch={dispatch} onClose={() => setOpenId(null)} />
      </Modal>
    </div>
  );
}

function FilterChip({ active, onClick, tier, children }) {
  const activeCls = tier ? `${tier.bg} ${tier.border} ${tier.text}` : 'border-sky-400 bg-sky-500/15 text-sky-200';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${active ? activeCls : 'border-white/10 text-zinc-400 hover:text-zinc-200'}`}
    >
      {children}
    </button>
  );
}
