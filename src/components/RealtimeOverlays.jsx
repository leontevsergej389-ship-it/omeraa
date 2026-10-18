import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Crown, Gift, LogOut, Megaphone, ShieldAlert, Sparkles, WifiOff } from 'lucide-react';
import LicensePlate from './LicensePlate.jsx';
import { Button, RarityBadge } from './ui.jsx';
import { TIER_BY_ID } from '../data/platesConfig.js';
import { formatPlate } from '../utils/plateEvaluator.js';
import { sound } from '../utils/soundEngine.js';
import { money } from '../utils/format.js';

/** «Игрок Ник только что выбил А777МР 97!» — всплывает сверху у всех онлайн-игроков. */
export function LiveDropBanners({ drops }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[7.5rem] z-[80] flex flex-col items-center gap-2 px-3">
      {drops.map((d) => {
        const t = TIER_BY_ID[d.plate.tier];
        return (
          <div
            key={d.id}
            className={`animate-slide-up flex max-w-xl items-center gap-3 rounded-2xl border bg-zinc-950/95 px-4 py-2.5 shadow-2xl backdrop-blur ${t.border}`}
            style={{ boxShadow: t.glow }}
          >
            {d.plate.tier === 'legendary' ? <Crown className="h-5 w-5 shrink-0 text-amber-300" /> : <Sparkles className="h-5 w-5 shrink-0 text-fuchsia-300" />}
            <span className="text-sm text-zinc-200">
              Игрок <b className="text-white">{d.username}</b> только что выбил{' '}
              <b className={d.plate.tier === 'legendary' ? 'text-shimmer' : t.text}>{formatPlate(d.plate)}</b>!
            </span>
            <span className={`hidden whitespace-nowrap text-xs font-semibold sm:inline ${t.text}`}>{money(d.plate.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Красный экран блокировки с сиреной. Появляется мгновенно, когда админ банит игрока. */
export function BanScreen({ reason, sirenKey, onLogout }) {
  useEffect(() => sound.siren(6), [sirenKey]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-red-950 p-6">
      <div className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_center,rgba(239,68,68,.45),transparent_65%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-2 bg-[repeating-linear-gradient(45deg,#ef4444_0_18px,#111_18px_36px)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2 bg-[repeating-linear-gradient(45deg,#ef4444_0_18px,#111_18px_36px)]" />
      <div className="animate-pop relative max-w-xl text-center">
        <ShieldAlert className="mx-auto h-20 w-20 animate-pulse text-red-300" />
        <h1 className="mt-6 font-display text-3xl font-bold uppercase leading-tight tracking-wide text-white sm:text-4xl">
          Ваш аккаунт заблокирован администратором
        </h1>
        <div className="mt-6 rounded-2xl border border-red-400/40 bg-black/40 px-5 py-4">
          <div className="text-xs uppercase tracking-widest text-red-300">Причина</div>
          <div className="mt-1 text-lg text-red-50">{reason || 'Не указана'}</div>
        </div>
        <Button variant="ghost" className="mt-8" onClick={onLogout}>
          <LogOut className="h-4 w-4" /> Выйти из аккаунта
        </Button>
      </div>
    </div>
  );
}

function giftConfetti() {
  const colors = ['#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#ffffff'];
  const base = { colors, zIndex: 95, disableForReducedMotion: true };
  confetti({ ...base, particleCount: 140, spread: 110, origin: { y: 0.4 } });
  setTimeout(() => confetti({ ...base, particleCount: 80, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } }), 200);
  setTimeout(() => confetti({ ...base, particleCount: 80, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } }), 350);
}

/** «Администратор выдал вам спецномер / баланс!» */
export function GiftModal({ gift, frame, onClose }) {
  const celebrated = useRef(null);
  useEffect(() => {
    if (celebrated.current === gift) return; // StrictMode запускает эффекты дважды — салют нужен один
    celebrated.current = gift;
    giftConfetti();
    sound.fanfareEpic();
  }, [gift]);

  const isPlate = gift.kind === 'plate';
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="animate-pop w-full max-w-lg rounded-3xl border border-amber-300/50 bg-gradient-to-b from-zinc-900 to-zinc-950 p-6 text-center shadow-[0_0_60px_rgba(251,191,36,.35)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <Gift className="mx-auto h-14 w-14 text-amber-300" />
        <h2 className="mt-3 font-display text-2xl font-bold uppercase tracking-wide text-white">
          {isPlate ? 'Администратор выдал вам спецномер!' : 'Администратор пополнил ваш баланс!'}
        </h2>
        <p className="mt-1 text-sm text-zinc-400">от {gift.from}</p>
        {isPlate ? (
          <div className="mt-5 space-y-3">
            <LicensePlate letters={gift.plate.letters} digits={gift.plate.digits} region={gift.plate.region} tier={gift.plate.tier} frame={frame} />
            <div className="flex items-center justify-center gap-3">
              <RarityBadge tier={gift.plate.tier} />
              <span className="font-display text-xl font-semibold text-amber-200">{money(gift.plate.value)}</span>
            </div>
            <p className="text-xs text-zinc-500">Номер уже стоит в вашем гараже</p>
          </div>
        ) : (
          <div className="mt-5 font-display text-4xl font-bold text-emerald-300">+{money(gift.amount)}</div>
        )}
        <Button variant="gold" size="lg" className="mt-6 w-full" onClick={onClose}>
          Забрать
        </Button>
      </div>
    </div>
  );
}

/** Системное объявление на весь экран. */
export function BroadcastOverlay({ announcement, onClose }) {
  const announced = useRef(null);
  useEffect(() => {
    if (announced.current === announcement) return;
    announced.current = announcement;
    sound.announce();
  }, [announcement]);

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-gradient-to-b from-sky-950/95 to-zinc-950/95 p-6 backdrop-blur" role="alertdialog" aria-modal="true">
      <div className="animate-pop max-w-2xl text-center">
        <Megaphone className="mx-auto h-16 w-16 text-sky-300" />
        <div className="mt-4 text-xs uppercase tracking-[.3em] text-sky-300">Объявление администрации</div>
        <p className="mt-4 whitespace-pre-wrap font-display text-2xl font-semibold leading-snug text-white sm:text-3xl">{announcement.message}</p>
        <p className="mt-4 text-sm text-zinc-400">
          — {announcement.from}, {new Date(announcement.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <Button variant="primary" size="lg" className="mt-8 min-w-48" onClick={onClose}>
          Понятно
        </Button>
      </div>
    </div>
  );
}

export function ConnectionBanner({ status }) {
  if (status === 'ready') return null;
  return (
    <div className="fixed inset-x-0 bottom-20 z-[75] flex justify-center px-4 md:bottom-4">
      <div className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-950/90 px-4 py-2 text-sm text-amber-100 shadow-xl">
        <WifiOff className="h-4 w-4" /> Связь с сервером потеряна — переподключаемся…
      </div>
    </div>
  );
}
