import { Check, Clock, Frame as FrameIcon, Rocket, ShoppingCart, Zap } from 'lucide-react';
import LicensePlate from './LicensePlate.jsx';
import { Button, Card, Icon, ProgressBar, SectionTitle } from './ui.jsx';
import { BOOSTERS, FRAMES, UPGRADES, upgradeCost } from '../data/shopConfig.js';
import { boosterRemaining, isBoosterActive } from '../state/selectors.js';
import { sound } from '../utils/soundEngine.js';
import { money, timer } from '../utils/format.js';

const FRAME_SAMPLE = { letters: 'ЕКХ', digits: '777', region: '77', tier: 'legendary' };

export default function UpgradesShop({ state, dispatch, notify }) {
  const now = Date.now();

  const buy = (action, cost, title) => {
    if (state.balance < cost) {
      sound.error();
      notify({ kind: 'error', title: 'Не хватает денег', text: `Нужно ещё ${money(cost - state.balance)}` });
      return;
    }
    dispatch(action);
    sound.purchase();
    notify({ kind: 'success', title, text: `−${money(cost)}` });
  };

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle icon={Rocket}>Прокачка</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {UPGRADES.map((u) => {
            const level = state.upgrades[u.id] ?? 0;
            const maxed = level >= u.maxLevel;
            const cost = maxed ? 0 : upgradeCost(u, level);
            const affordable = state.balance >= cost;
            return (
              <Card key={u.id} className="flex flex-col p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-sky-500/15 p-2.5 text-sky-300">
                    <Icon name={u.icon} className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-base font-semibold uppercase tracking-wide">{u.name}</h3>
                      <span className="whitespace-nowrap text-xs text-zinc-400">
                        ур. {level}/{u.maxLevel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">{u.description}</p>
                  </div>
                </div>
                <ProgressBar value={level} max={u.maxLevel} className="mt-3" />
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-zinc-300">{u.format(level)}</span>
                  {!maxed && <span className="text-emerald-400">→ {u.format(level + 1)}</span>}
                </div>
                <div className="mt-auto pt-4">
                  {maxed ? (
                    <Button variant="subtle" className="w-full" disabled>
                      <Check className="h-4 w-4" /> Максимум
                    </Button>
                  ) : (
                    <Button
                      variant={affordable ? 'primary' : 'ghost'}
                      className="w-full"
                      onClick={() => buy({ type: 'BUY_UPGRADE', id: u.id }, cost, `${u.name}: уровень ${level + 1}`)}
                    >
                      <ShoppingCart className="h-4 w-4" /> {money(cost)}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle icon={Zap}>Бустеры</SectionTitle>
        <p className="-mt-1 mb-3 text-sm text-zinc-500">Временные эффекты. Повторная покупка продлевает действие.</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {BOOSTERS.map((b) => {
            const active = isBoosterActive(state, b.id, now);
            const left = boosterRemaining(state, b.id, now);
            return (
              <Card key={b.id} className={`flex flex-col p-4 ${active ? 'border-emerald-400/40' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-2.5 ${active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                    <Icon name={b.icon} className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold uppercase tracking-wide">{b.name}</h3>
                    <p className="text-xs text-zinc-400">{b.description}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
                  <Clock className="h-3.5 w-3.5" />
                  {active ? <span className="font-mono text-emerald-300">осталось {timer(left)}</span> : <span>{b.duration} сек</span>}
                </div>
                {active && <ProgressBar value={left} max={Math.max(left, b.duration)} color="bg-emerald-500" className="mt-2" />}
                <div className="mt-auto pt-4">
                  <Button
                    variant={state.balance >= b.cost ? 'gold' : 'ghost'}
                    className="w-full"
                    onClick={() => buy({ type: 'BUY_BOOSTER', id: b.id }, b.cost, active ? `${b.name}: продлено` : `${b.name}: активирован`)}
                  >
                    {active ? 'Продлить' : 'Активировать'} · {money(b.cost)}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle icon={FrameIcon}>Рамки для номеров</SectionTitle>
        <p className="-mt-1 mb-3 text-sm text-zinc-500">Примерять можно бесплатно на главной и в гараже. Купленная рамка даёт бонус к цене продажи.</p>
        <div className="grid gap-4 md:grid-cols-2">
          {FRAMES.map((f) => {
            const owned = state.frames.owned.includes(f.id);
            const active = state.frames.active === f.id;
            return (
              <Card key={f.id} className={`p-4 ${active ? 'border-sky-400/50' : ''}`}>
                <LicensePlate {...FRAME_SAMPLE} frame={f.id} glow={false} />
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display font-semibold uppercase tracking-wide">{f.name}</h3>
                    <p className="text-xs text-zinc-400">{f.description}</p>
                  </div>
                  {f.saleBonus > 0 && <span className="whitespace-nowrap rounded-lg bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300">+{Math.round(f.saleBonus * 100)}%</span>}
                </div>
                <div className="mt-3">
                  {active ? (
                    <Button variant="subtle" className="w-full" disabled>
                      <Check className="h-4 w-4" /> Установлена
                    </Button>
                  ) : owned ? (
                    <Button variant="ghost" className="w-full" onClick={() => { dispatch({ type: 'SET_FRAME', id: f.id }); sound.click(); }}>
                      Установить
                    </Button>
                  ) : (
                    <Button
                      variant={state.balance >= f.cost ? 'gold' : 'ghost'}
                      className="w-full"
                      onClick={() => buy({ type: 'BUY_FRAME', id: f.id }, f.cost, `Рамка «${f.name}» куплена`)}
                    >
                      <ShoppingCart className="h-4 w-4" /> {money(f.cost)}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
