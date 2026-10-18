import { CarFront, Settings, Shield, TrendingUp, Volume2, VolumeX, Wallet, Zap } from 'lucide-react';
import { getCapacity, getGarageValue, getIncomePerSec } from '../state/selectors.js';
import { money, moneyShort, perSecond } from '../utils/format.js';

function Stat({ icon: IconCmp, label, value, full, accent }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/8 bg-zinc-900/80 px-3 py-1.5" title={full}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
        <IconCmp className={`h-3 w-3 ${accent}`} />
        {label}
      </div>
      <div className="truncate font-display text-sm font-semibold text-zinc-100 sm:text-base">{value}</div>
    </div>
  );
}

export default function Header({ state, user, online, soundOn, tabs, tab, onTab, autoRunning, badges, onOpenSettings, onToggleSound }) {
  const now = Date.now();
  const income = getIncomePerSec(state, now);
  const garageValue = getGarageValue(state);
  const stats = (
    <>
      <Stat icon={Wallet} label="Баланс" value={moneyShort(state.balance)} full={money(state.balance)} accent="text-emerald-400" />
      <Stat icon={TrendingUp} label="Доход" value={perSecond(income)} accent="text-sky-400" />
      <Stat
        icon={CarFront}
        label={`Гараж ${state.garage.length}/${getCapacity(state)}`}
        value={moneyShort(garageValue)}
        full={money(garageValue)}
        accent="text-amber-400"
      />
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-zinc-950/85 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 pt-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="flex h-9 items-center rounded-md border-2 border-zinc-900 bg-white px-1.5 font-display text-sm font-bold leading-none text-zinc-900 shadow-[0_0_0_2px_rgba(255,255,255,.15)]">
              <span>А777АА</span>
              <span className="ml-1 border-l-2 border-zinc-900 pl-1 text-[10px]">97</span>
            </div>
            <div className="hidden leading-tight md:block">
              <div className="font-display text-base font-bold uppercase tracking-wider">Номера РФ</div>
              <div className="text-[11px] text-zinc-500">генератор госномеров</div>
            </div>
          </div>

          <div className="ml-auto hidden min-w-0 flex-1 grid-cols-3 gap-2 sm:grid sm:max-w-xl">{stats}</div>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
            <div className="mr-1 flex flex-col items-end leading-tight" title={`${online} игроков онлайн`}>
              <span className="flex max-w-28 items-center gap-1 truncate text-xs font-semibold text-zinc-200">
                {user.role === 'admin' && <Shield className="h-3 w-3 shrink-0 text-red-400" />}
                <span className="truncate">{user.username}</span>
              </span>
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {online} онлайн
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleSound}
              className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
              aria-label={soundOn ? 'Выключить звук' : 'Включить звук'}
            >
              {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Настройки"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* На телефоне статистика уходит во вторую строку, чтобы суммы не обрезались */}
        <div className="mt-2 grid grid-cols-3 gap-2 sm:hidden">{stats}</div>

        {/* Вкладки — на десктопе в шапке, на телефоне внизу экрана */}
        <nav className="no-scrollbar -mb-px mt-3 hidden gap-1 overflow-x-auto md:flex">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              className={`relative flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                tab === t.id ? 'border-sky-400 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.id === 'generator' && autoRunning && <Zap className="h-3.5 w-3.5 animate-pulse text-emerald-400" />}
              {badges[t.id] > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-zinc-900">{badges[t.id]}</span>}
            </button>
          ))}
        </nav>
        <div className="h-3 md:hidden" />
      </div>
    </header>
  );
}

export function MobileNav({ tabs, tab, onTab, autoRunning, badges }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            className={`relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${tab === t.id ? 'text-sky-300' : 'text-zinc-500'}`}
          >
            <t.icon className="h-5 w-5" />
            <span className="truncate px-0.5">{t.short}</span>
            {t.id === 'generator' && autoRunning && <span className="absolute right-[28%] top-1.5 h-2 w-2 animate-pulse rounded-full bg-emerald-400" />}
            {badges[t.id] > 0 && (
              <span className="absolute right-[22%] top-1 rounded-full bg-amber-400 px-1 text-[9px] font-bold leading-tight text-zinc-900">{badges[t.id]}</span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
