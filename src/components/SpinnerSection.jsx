import { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  BadgePercent, Dices, Gift, Hand, HandCoins, ScrollText, Lock, MapPin, Play, Square, Star, Target, Timer, Warehouse, Zap,
} from 'lucide-react';
import LicensePlate from './LicensePlate.jsx';
import RegionSelect from './RegionSelect.jsx';
import { Button, Card, RarityBadge, SectionTitle, TagChip, Toggle } from './ui.jsx';
import { regionCoef, regionName, TIER_BY_ID, TIER_RANK, SPECIAL_SERIES } from '../data/platesConfig.js';
import { BOOSTERS, FRAMES } from '../data/shopConfig.js';
import { computeChances, formatPlate, randomDigit, randomLetter, randomRegionCode, salePrice } from '../utils/plateEvaluator.js';
import {
  boosterRemaining, getAutoDelay, getCapacity, getLuck, getPlateRent, getSaleMult, getSpinCost, isBoosterActive,
} from '../state/selectors.js';
import { canGetSubsidy, pendingResolution, pendingSaleValue } from '../state/gameState.js';
import { sound } from '../utils/soundEngine.js';
import { money, percent, perSecond, timer } from '../utils/format.js';

// Момент «остановки» каждого символа: Б, 0, 0, 0, Б, Б, регион — слева направо, как барабаны.
// Если сервер ответил позже, график сдвигается: символ встаёт не раньше чем через LOCK_GAP_MS после ответа.
const LOCK_AT = [210, 260, 305, 350, 400, 445, 520];
const LOCK_GAP_MS = 80;
const STEP_MS = 42;
const PLACEHOLDER = { letters: 'ААА', digits: '000', region: '77' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fireConfetti(tier) {
  if (tier === 'legendary') {
    const colors = ['#fbbf24', '#f59e0b', '#ef4444', '#ffffff', '#fde68a'];
    const base = { colors, disableForReducedMotion: true, zIndex: 60 };
    confetti({ ...base, particleCount: 160, spread: 100, origin: { y: 0.35 }, scalar: 1.1 });
    setTimeout(() => confetti({ ...base, particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: 0.65 } }), 250);
    setTimeout(() => confetti({ ...base, particleCount: 90, angle: 120, spread: 70, origin: { x: 1, y: 0.65 } }), 420);
  } else if (tier === 'epic') {
    confetti({ particleCount: 70, spread: 70, origin: { y: 0.4 }, colors: ['#c084fc', '#a855f7', '#e9d5ff', '#ffffff'], disableForReducedMotion: true, zIndex: 60 });
  }
}

const CHANCE_ROWS = [
  ['special', 'Спецсерия региона'],
  ['nice', 'Блатные буквы'],
  ['tripleLetters', 'Три одинаковые буквы'],
  ['firstTen', 'Первая десятка'],
  ['tripleDigits', 'Три одинаковые цифры'],
  ['bingo', 'Бинго (цифры = регион)'],
];

export default function SpinnerSection({ state, dispatch, api, stateRef, notify, isActive, onAutoChange, onNavigate }) {
  const now = Date.now();
  const { current, settings } = state;
  const [display, setDisplay] = useState(() => current?.plate ?? PLACEHOLDER);
  const [spinning, setSpinning] = useState([]);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(false);
  const [revealKey, setRevealKey] = useState(0);
  const [previewFrame, setPreviewFrame] = useState(null);
  const [floats, setFloats] = useState([]);

  const busyRef = useRef(false);
  const autoRef = useRef(false);
  const timerRef = useRef(null);
  const finishRef = useRef(null);
  const mountedRef = useRef(false);
  const activeRef = useRef(isActive);
  activeRef.current = isActive;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      autoRef.current = false;
      finishRef.current?.();
      clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => onAutoChange?.(auto), [auto, onAutoChange]);

  // Внешние изменения текущего номера (сброс прогресса, загрузка) — синхронизируем табличку.
  const currentId = current?.plate?.id;
  useEffect(() => {
    if (busyRef.current) return;
    const plate = stateRef.current.current?.plate;
    setDisplay(plate ?? PLACEHOLDER);
  }, [currentId, stateRef]);

  const showFloat = useCallback((text, tone = 'text-emerald-300') => {
    const id = `${Date.now()}-${Math.random()}`;
    setFloats((list) => [...list.slice(-4), { id, text, tone }]);
    setTimeout(() => setFloats((list) => list.filter((f) => f.id !== id)), 1200);
  }, []);

  /**
   * Барабан начинает вращаться сразу, а символы останавливаются, когда сервер пришлёт номер.
   * Возвращает номер или null, если сервер отказал (или компонент размонтировали).
   */
  const animate = useCallback(
    (platePromise) =>
      new Promise((resolve) => {
        const start = performance.now();
        const locked = new Set();
        let plate; // undefined — ждём сервер, null — отказ
        let lockAt = null;
        platePromise.then((p) => {
          plate = p ?? null;
          if (plate) {
            const arrived = performance.now() - start;
            lockAt = LOCK_AT.map((t, i) => Math.max(t, arrived + LOCK_GAP_MS + i * 45));
          }
        });

        const finish = (result) => {
          clearTimeout(timerRef.current);
          finishRef.current = null;
          if (result) setDisplay(result);
          setSpinning([]);
          resolve(result);
        };
        finishRef.current = () => finish(plate ?? null);

        const step = () => {
          const elapsed = performance.now() - start;
          if (plate === null) return finish(null);
          if (lockAt && elapsed >= lockAt[6]) {
            sound.lock();
            return finish(plate);
          }
          const isLocked = (i) => lockAt !== null && elapsed >= lockAt[i];
          const final = plate && [plate.letters[0], plate.digits[0], plate.digits[1], plate.digits[2], plate.letters[1], plate.letters[2]];
          const chars = [0, 1, 2, 3, 4, 5].map((i) => (isLocked(i) ? final[i] : i >= 1 && i <= 3 ? randomDigit() : randomLetter()));
          setDisplay({
            letters: chars[0] + chars[4] + chars[5],
            digits: chars[1] + chars[2] + chars[3],
            region: isLocked(6) ? plate.region : randomRegionCode(),
          });
          const stillSpinning = [];
          let justLocked = false;
          for (let i = 0; i < 7; i++) {
            if (!isLocked(i)) stillSpinning.push(i);
            else if (!locked.has(i)) {
              locked.add(i);
              justLocked = true;
            }
          }
          setSpinning(stillSpinning);
          if (justLocked) sound.lock();
          else sound.tick();
          timerRef.current = setTimeout(step, STEP_MS);
        };
        step();
      }),
    [],
  );

  /** Один прокрут на сервере. Возвращает выпавший номер или null, если крутить нельзя. */
  const spinOnce = useCallback(
    async (isAuto = false) => {
      if (busyRef.current) return null;
      const s = stateRef.current;
      const t = Date.now();
      const cost = getSpinCost(s, t);
      const pending = pendingResolution(s);

      // Быстрые проверки на клиенте — чтобы не гонять запрос впустую. Сервер всё равно перепроверит.
      if (pending === 'sell' && TIER_RANK[s.current.plate.tier] >= TIER_RANK.rare) {
        sound.error();
        notify({
          kind: 'warning',
          title: 'Гараж заполнен',
          text: `Решите судьбу номера ${formatPlate(s.current.plate)}: продайте его или освободите место в гараже.`,
        });
        return null;
      }
      if (s.balance + pendingSaleValue(s, t) < cost) {
        sound.error();
        notify({ kind: 'error', title: 'Не хватает денег', text: `Прокрут стоит ${money(cost)}. Продайте номера из гаража или подождите доход от аренды.` });
        return null;
      }

      busyRef.current = true;
      setBusy(true);
      sound.unlock();

      if (pending && s.current.revealed) {
        const prev = s.current.plate;
        if (pending === 'keep') notify({ kind: 'info', title: 'Номер отправлен в гараж', text: `${formatPlate(prev)} · ${TIER_BY_ID[prev.tier].name}` });
        else showFloat(`+${money(salePrice(prev, getSaleMult(s, t)))}`);
      }

      const request = api.spin();
      const platePromise = request.then((r) => r.plate ?? null);
      if (s.settings.fastSpin) {
        const p = await platePromise;
        if (p) {
          setDisplay(p);
          setSpinning([]);
          sound.lock();
        }
      } else {
        await animate(platePromise);
      }

      // Результат применяется только сейчас — иначе баланс, история и достижения «проспойлерили» бы барабан.
      const res = await request;
      api.commit(res.state);
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);

      if (!res.plate) {
        setDisplay(stateRef.current.current?.plate ?? PLACEHOLDER);
        sound.error();
        notify({ kind: 'error', title: 'Прокрут не состоялся', text: res.error ?? 'Сервер отклонил прокрут' });
        return null;
      }

      const plate = res.plate;
      if (mountedRef.current) setRevealKey((k) => k + 1);
      if (!(isAuto && plate.tier === 'common')) sound.reveal(plate.tier);
      fireConfetti(plate.tier);
      if (TIER_RANK[plate.tier] >= TIER_RANK.epic) {
        notify({ kind: plate.tier, title: `${TIER_BY_ID[plate.tier].name} номер!`, text: `${formatPlate(plate)} — ${money(plate.value)}`, duration: 5000 });
      }
      return plate;
    },
    [animate, api, notify, showFloat, stateRef],
  );

  const stopAuto = useCallback(
    (reason, kind = 'info') => {
      autoRef.current = false;
      if (mountedRef.current) setAuto(false);
      if (reason) notify({ kind, title: 'Авто-прокрут остановлен', text: reason, duration: 5000 });
    },
    [notify],
  );

  const startAuto = useCallback(async () => {
    if (autoRef.current || busyRef.current) return;
    autoRef.current = true;
    setAuto(true);
    const session = stateRef.current.createdAt;

    while (autoRef.current && mountedRef.current) {
      const plate = await spinOnce(true);
      if (!plate) {
        stopAuto();
        break;
      }
      if (!autoRef.current) break;
      await sleep(16); // даём React применить ответ сервера
      const s = stateRef.current;
      if (s.createdAt !== session) {
        stopAuto();
        break;
      }
      if (s.settings.stopOn[plate.tier]) {
        stopAuto(`Выпал ${TIER_BY_ID[plate.tier].name.toLowerCase()} номер ${formatPlate(plate)}`, plate.tier);
        break;
      }
      const willSell = plate.tier === 'common' && s.settings.autoSellCommon;
      if (!willSell && s.garage.length >= getCapacity(s)) {
        stopAuto('Гараж заполнен. Продайте лишнее или купите расширение в Магазине МРЭО.', 'warning');
        break;
      }
      if (willSell) showFloat(`+${money(salePrice(plate, getSaleMult(s, Date.now())))}`);
      dispatch({ type: 'AUTO_RESOLVE' });
      await sleep(getAutoDelay(s));
    }
  }, [dispatch, showFloat, spinOnce, stateRef, stopAuto]);

  // Пробел — крутить (только на вкладке генератора).
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' || e.repeat || !activeRef.current || autoRef.current) return;
      const tag = document.activeElement?.tagName;
      if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tag)) return;
      e.preventDefault();
      spinOnce(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spinOnce]);

  const keep = () => {
    dispatch({ type: 'KEEP_CURRENT' });
    sound.click();
    showFloat('В гараж!', 'text-sky-300');
  };

  const sell = () => {
    const p = current.plate;
    const price = salePrice(p, getSaleMult(state, Date.now()));
    dispatch({ type: 'SELL_CURRENT' });
    sound.coin(1 + TIER_RANK[p.tier]);
    showFloat(`+${money(price)}`);
  };

  // ── Производные значения для отрисовки ──
  const cost = getSpinCost(state, now);
  const saleMult = getSaleMult(state, now);
  const capacity = getCapacity(state);
  const garageFull = state.garage.length >= capacity;
  const luck = getLuck(state, now);
  const chances = computeChances({ luck, vip: settings.vip, targetRegion: settings.targetRegion });
  const revealed = Boolean(current?.revealed) && !busy;
  const plate = current?.plate;
  const showResult = revealed && plate;
  const decisionPending = showResult && !current.handled;
  const frame = previewFrame ?? state.frames.active;
  const activeBoosters = BOOSTERS.filter((b) => isBoosterActive(state, b.id, now));
  const subsidy = !busy && !auto && canGetSubsidy(state, now);
  const targetSpecials = settings.targetRegion ? SPECIAL_SERIES.filter((s) => s.regions.includes(settings.targetRegion)) : [];
  const tier = showResult ? plate.tier : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* ── Сцена ── */}
      <Card className="relative overflow-hidden p-4 sm:p-6 lg:sticky lg:top-32 lg:self-start">
        {tier === 'legendary' && <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-amber-500/10 via-red-500/5 to-transparent" />}
        {tier === 'epic' && <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-fuchsia-500/10 to-transparent" />}

        <div className="relative flex min-h-9 flex-wrap items-center justify-center gap-2">
          {busy && <span className="animate-pulse text-sm font-medium uppercase tracking-widest text-zinc-400">Крутим барабан…</span>}
          {!busy && showResult && <RarityBadge key={revealKey} tier={plate.tier} size="lg" className="animate-pop" />}
          {!busy && !showResult && <span className="text-sm uppercase tracking-widest text-zinc-500">Нажмите «Крутить» или пробел</span>}
          {showResult && plate.vip && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-300">
              <Star className="h-3 w-3" /> VIP
            </span>
          )}
        </div>

        <div className="relative mx-auto mt-5 max-w-3xl">
          <div key={revealKey} className={`${busy ? 'plate-spinning' : showResult ? 'animate-pop' : ''} ${!current ? 'opacity-60' : ''}`}>
            <LicensePlate
              letters={display.letters}
              digits={display.digits}
              region={display.region}
              tier={tier}
              frame={frame}
              spinning={spinning}
            />
          </div>
          {floats.map((f) => (
            <span key={f.id} className={`animate-float-up pointer-events-none absolute left-1/2 top-0 z-10 whitespace-nowrap font-display text-2xl font-bold drop-shadow ${f.tone}`}>
              {f.text}
            </span>
          ))}
        </div>

        {/* Примерка рамок */}
        <div className="relative mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs uppercase tracking-wider text-zinc-500">Рамка:</span>
          {FRAMES.map((f) => {
            const owned = state.frames.owned.includes(f.id);
            const selected = frame === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  if (owned) {
                    dispatch({ type: 'SET_FRAME', id: f.id });
                    setPreviewFrame(null);
                  } else setPreviewFrame(previewFrame === f.id ? null : f.id);
                }}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition ${
                  selected ? 'border-sky-400 bg-sky-500/15 text-sky-200' : 'border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {!owned && <Lock className="h-3 w-3" />}
                {f.name}
              </button>
            );
          })}
          {previewFrame && (
            <button type="button" onClick={() => onNavigate('shop')} className="text-xs font-medium text-amber-300 underline-offset-2 hover:underline">
              Примерка · купить в магазине
            </button>
          )}
        </div>

        {/* Результат */}
        <div className="relative mt-5 min-h-[120px]">
          {showResult ? (
            <div key={revealKey} className="animate-slide-up space-y-3 text-center">
              <div className="flex flex-wrap items-baseline justify-center gap-x-4 gap-y-1">
                <span className={`font-display text-3xl font-bold sm:text-4xl ${tier === 'legendary' ? 'text-shimmer' : TIER_BY_ID[tier].text}`}>
                  {money(plate.value)}
                </span>
                <span className="text-sm text-zinc-400">
                  продажа: <b className="text-zinc-200">{money(salePrice(plate, saleMult))}</b>
                  {saleMult > 1 && <span className="text-emerald-400"> (+{Math.round((saleMult - 1) * 100)}%)</span>}
                </span>
              </div>
              <div className="text-xs text-zinc-500">
                <MapPin className="mr-1 inline h-3 w-3" />
                {regionName(plate.region)} · код {plate.region}
                {TIER_RANK[plate.tier] >= TIER_RANK.rare && (
                  <span className="ml-2 text-emerald-400">аренда в гараже: +{perSecond(getPlateRent(state, plate, now))}</span>
                )}
              </div>
              {plate.tags.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {plate.tags.map((tag) => (
                    <TagChip key={tag.id} tag={tag} />
                  ))}
                </div>
              ) : (
                <div className="text-sm text-zinc-500">Обычный номер без комбинаций</div>
              )}
              {current.handled && (
                <div className={`text-sm font-medium ${current.action === 'sold' ? 'text-emerald-400' : 'text-sky-400'}`}>
                  {current.action === 'sold' ? `Продан за ${money(current.soldFor)}` : 'Стоит в гараже'}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-[120px] items-center justify-center text-center text-sm text-zinc-500">
              {busy ? 'Барабаны вращаются…' : 'Крутите барабан, собирайте блатные серии и стройте автопарк мечты.'}
            </div>
          )}
        </div>

        {/* Кнопки */}
        <div className="relative mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {auto ? (
            <Button variant="danger" size="lg" className="sm:min-w-64" onClick={() => stopAuto()}>
              <Square className="h-5 w-5" /> Остановить авто
            </Button>
          ) : (
            <Button variant="primary" size="lg" className="sm:min-w-64" onClick={() => spinOnce(false)} disabled={busy}>
              <Dices className={`h-6 w-6 ${busy ? 'animate-spin' : ''}`} />
              <span className="flex flex-col items-start leading-tight">
                <span className="font-display text-lg uppercase tracking-wide">{settings.vip ? 'VIP-прокрут' : 'Крутить'}</span>
                <span className="text-xs font-normal opacity-80">госпошлина {money(cost)}</span>
              </span>
            </Button>
          )}
          {decisionPending && !auto && (
            <div className="grid grid-cols-2 gap-3 sm:flex">
              <Button variant="ghost" size="lg" onClick={keep} disabled={garageFull} title={garageFull ? 'Гараж заполнен' : ''}>
                <Warehouse className="h-5 w-5" />
                <span className="flex flex-col items-start leading-tight">
                  <span>В гараж</span>
                  <span className="text-[11px] font-normal opacity-70">{garageFull ? 'мест нет' : `${state.garage.length}/${capacity}`}</span>
                </span>
              </Button>
              <Button variant="success" size="lg" onClick={sell}>
                <HandCoins className="h-5 w-5" />
                <span className="flex flex-col items-start leading-tight">
                  <span>Продать</span>
                  <span className="text-[11px] font-normal opacity-80">{money(salePrice(plate, saleMult))}</span>
                </span>
              </Button>
            </div>
          )}
        </div>
        {decisionPending && !auto && (
          <p className="relative mt-3 text-center text-xs text-zinc-500">
            При следующем прокруте обычные и необычные номера продаются автоматически, а Rare+ уезжают в гараж.
          </p>
        )}

        {subsidy && (
          <div className="relative mx-auto mt-5 flex max-w-md flex-col items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-center">
            <div className="text-sm text-amber-200">Вы на мели, а гараж пуст. Государство поможет!</div>
            <Button variant="gold" onClick={() => dispatch({ type: 'SUBSIDY' })}>
              <Gift className="h-4 w-4" /> Получить субсидию 5 000 ₽
            </Button>
          </div>
        )}
      </Card>

      {/* ── Боковая панель ── */}
      <div className="space-y-5">
        <Card className="p-4">
          <SectionTitle icon={Target}>Ставка на параметры</SectionTitle>
          <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Регион</label>
          <RegionSelect
            value={settings.targetRegion}
            onChange={(v) => dispatch({ type: 'SET_SETTING', key: 'targetRegion', value: v })}
            allowAny
            disabled={auto}
          />
          {settings.targetRegion && (
            <p className="mt-2 text-xs text-zinc-400">
              Коэффициент региона ×{regionCoef(settings.targetRegion)} · прокрут дороже в ×{(1 + 0.6 * regionCoef(settings.targetRegion)).toFixed(2)}
              {targetSpecials.length > 0 && (
                <span className="block text-red-300">Спецсерии здесь: {targetSpecials.map((s) => s.letters).join(', ')} — шанс ×2</span>
              )}
            </p>
          )}

          <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/5 p-3">
            <Toggle
              checked={settings.vip}
              onChange={(v) => dispatch({ type: 'SET_SETTING', key: 'vip', value: v })}
              disabled={auto}
              label={
                <span className="inline-flex items-center gap-1.5 text-amber-200">
                  <Star className="h-4 w-4" /> VIP-прокрут
                </span>
              }
              description="Спецсерии и первая десятка ×4, остальные паттерны ×2. Цена ×2."
            />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-800/60 px-3 py-2">
            <span className="text-sm text-zinc-400">Цена прокрута</span>
            <span className="font-display text-lg font-semibold text-zinc-100">
              {money(cost)}
              {isBoosterActive(state, 'discount', now) && <BadgePercent className="ml-1 inline h-4 w-4 text-emerald-400" />}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {CHANCE_ROWS.map(([key, label]) => (
              <div key={key} className="flex justify-between gap-2 text-zinc-500">
                <span className="truncate">{label}</span>
                <span className="font-semibold text-zinc-300">{percent(chances[key])}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-zinc-600">Удача: ×{luck.toFixed(2)} (Связи в МРЭО и бустеры)</p>
        </Card>

        <Card className="p-4">
          <SectionTitle icon={Zap}>Авто-прокрут</SectionTitle>
          {auto ? (
            <Button variant="danger" className="w-full" onClick={() => stopAuto()}>
              <Square className="h-4 w-4" /> Остановить
            </Button>
          ) : (
            <Button variant="success" className="w-full" onClick={startAuto} disabled={busy}>
              <Play className="h-4 w-4" /> Запустить авто-прокрут
            </Button>
          )}
          <div className="mt-4">
            <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Останавливаться при выпадении</div>
            <div className="flex flex-wrap gap-2">
              {['rare', 'epic', 'legendary'].map((t) => {
                const on = settings.stopOn[t];
                const info = TIER_BY_ID[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => dispatch({ type: 'SET_STOP_ON', tier: t, value: !on })}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${on ? `${info.bg} ${info.border} ${info.text}` : 'border-white/10 text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {info.short}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <Toggle
              checked={settings.autoSellCommon}
              onChange={(v) => dispatch({ type: 'SET_SETTING', key: 'autoSellCommon', value: v })}
              label="Автопродажа обычных"
              description="Common-номера сразу уходят перекупам"
            />
            <Toggle
              checked={settings.fastSpin}
              onChange={(v) => dispatch({ type: 'SET_SETTING', key: 'fastSpin', value: v })}
              label="Быстрая прокрутка"
              description="Без анимации барабана"
            />
          </div>
          <p className="mt-3 flex items-center gap-1 text-[11px] text-zinc-600">
            <Timer className="h-3 w-3" /> Пауза между прокрутами: {getAutoDelay(state)} мс · остальные номера едут в гараж
          </p>
        </Card>

        {activeBoosters.length > 0 && (
          <Card className="p-4">
            <SectionTitle icon={Zap}>Активные бустеры</SectionTitle>
            <div className="space-y-2">
              {activeBoosters.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-2 text-sm">
                  <span className="text-emerald-200">{b.name}</span>
                  <span className="font-mono text-emerald-300">{timer(boosterRemaining(state, b.id, now))}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-4">
          <SectionTitle icon={ScrollText}>Последние номера</SectionTitle>
          {state.recent.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-zinc-500">
              <Hand className="h-4 w-4" /> Здесь появится история прокрутов
            </p>
          ) : (
            <ul className="space-y-1.5">
              {state.recent.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <div className="w-28 shrink-0">
                    <LicensePlate letters={p.letters} digits={p.digits} region={p.region} frame={null} glow={false} />
                  </div>
                  <span className={`truncate text-xs font-semibold ${TIER_BY_ID[p.tier].text}`}>{TIER_BY_ID[p.tier].name}</span>
                  <span className="ml-auto whitespace-nowrap text-xs text-zinc-400">{money(p.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
