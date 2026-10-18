import { useEffect } from 'react';
import {
  Anchor, Axe, BadgePercent, Banknote, Building, CarFront, CircleDollarSign, Crown, Dices, Flame, Frame, Gauge, Gem,
  HandCoins, Handshake, Heart, Landmark, Mail, Map, MapPin, Medal, Mountain, PartyPopper, Percent, Rocket, Search,
  ShieldCheck, Siren, Sparkle, Sparkles, Star, Target, Trees, TrendingUp, Type, Wallet, Warehouse, X,
} from 'lucide-react';
import { TIER_BY_ID } from '../data/platesConfig.js';
import { multiplier } from '../utils/format.js';

/** Иконки, на которые конфиги ссылаются по имени. */
const ICONS = {
  Anchor, Axe, BadgePercent, Banknote, Building, CarFront, CircleDollarSign, Crown, Dices, Flame, Frame, Gauge, Gem,
  HandCoins, Handshake, Heart, Landmark, Mail, Map, MapPin, Medal, Mountain, PartyPopper, Percent, Rocket, Search,
  ShieldCheck, Siren, Sparkle, Sparkles, Star, Target, Trees, TrendingUp, Type, Wallet, Warehouse,
};

export function Icon({ name, ...props }) {
  const Cmp = ICONS[name] ?? Sparkle;
  return <Cmp {...props} />;
}

export function RarityBadge({ tier, size = 'md', className = '' }) {
  const t = TIER_BY_ID[tier];
  if (!t) return null;
  const sizes = { sm: 'px-1.5 py-0.5 text-[10px]', md: 'px-2.5 py-1 text-xs', lg: 'px-3.5 py-1.5 text-sm' };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold uppercase tracking-wider ${t.bg} ${t.border} ${t.text} ${sizes[size]} ${className}`}
    >
      {tier === 'legendary' && <Crown className="h-3 w-3" />}
      {tier === 'epic' && <Sparkles className="h-3 w-3" />}
      {tier === 'rare' && <Gem className="h-3 w-3" />}
      <span className={tier === 'legendary' ? 'text-shimmer' : ''}>{t.name}</span>
      {size !== 'sm' && <span className="opacity-60">· {t.short}</span>}
    </span>
  );
}

const TAG_STYLES = {
  special: 'border-red-400/60 bg-red-500/15 text-red-200',
  letters: 'border-amber-400/50 bg-amber-500/10 text-amber-200',
  digits: 'border-sky-400/50 bg-sky-500/10 text-sky-200',
  bingo: 'border-fuchsia-400/50 bg-fuchsia-500/10 text-fuchsia-200',
  combo: 'border-yellow-300/70 bg-yellow-400/15 text-yellow-100',
  region: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
};

export function TagChip({ tag, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium ${TAG_STYLES[tag.kind] ?? TAG_STYLES.region} ${className}`}
    >
      {tag.kind === 'special' && <Siren className="h-3.5 w-3.5" />}
      {tag.label}
      <span className="font-bold opacity-90">{multiplier(tag.mult)}</span>
    </span>
  );
}

export function Card({ className = '', children, ...props }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-zinc-900/70 shadow-xl shadow-black/20 backdrop-blur ${className}`} {...props}>
      {children}
    </div>
  );
}

export function SectionTitle({ icon: IconCmp, children, right }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-zinc-100">
        {IconCmp && <IconCmp className="h-5 w-5 text-sky-400" />}
        {children}
      </h2>
      {right}
    </div>
  );
}

const BTN = {
  primary: 'bg-gradient-to-b from-sky-400 to-sky-600 text-white shadow-lg shadow-sky-900/40 hover:from-sky-300 hover:to-sky-500',
  success: 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-900/40 hover:from-emerald-300 hover:to-emerald-500',
  gold: 'bg-gradient-to-b from-amber-300 to-amber-500 text-zinc-900 shadow-lg shadow-amber-900/40 hover:from-amber-200 hover:to-amber-400',
  danger: 'bg-gradient-to-b from-rose-500 to-rose-700 text-white shadow-lg shadow-rose-900/40 hover:from-rose-400 hover:to-rose-600',
  ghost: 'border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10',
  subtle: 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700',
};

export function Button({ variant = 'ghost', size = 'md', className = '', children, ...props }) {
  const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-14 px-6 text-base' };
  return (
    <button
      type="button"
      className={`inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.97] disabled:pointer-events-none disabled:opacity-40 ${BTN[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <label className={`flex cursor-pointer items-start justify-between gap-3 ${disabled ? 'opacity-50' : ''}`}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-200">{label}</span>
        {description && <span className="block text-xs text-zinc-500">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-sky-500' : 'bg-zinc-700'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export function ProgressBar({ value, max, color = 'bg-sky-500', className = '' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-zinc-800 ${className}`}>
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={`animate-slide-up max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-zinc-900 p-5 shadow-2xl sm:rounded-3xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="font-display text-xl font-semibold uppercase tracking-wide">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Закрыть">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatTile({ icon: IconCmp, label, value, sub, accent = 'text-sky-400' }) {
  return (
    <div className="rounded-xl border border-white/8 bg-zinc-900/60 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
        {IconCmp && <IconCmp className={`h-3.5 w-3.5 ${accent}`} />}
        {label}
      </div>
      <div className="mt-1 truncate font-display text-lg font-semibold text-zinc-100">{value}</div>
      {sub && <div className="truncate text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}
