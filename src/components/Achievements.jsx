import { useMemo } from 'react';
import { ChartColumn, Check, Gift, Layers, Lock, Trophy } from 'lucide-react';
import LicensePlate from './LicensePlate.jsx';
import { Button, Card, Icon, ProgressBar, RarityBadge, SectionTitle, StatTile } from './ui.jsx';
import { ACHIEVEMENTS, COLLECTIONS } from '../data/achievementsConfig.js';
import { TIERS } from '../data/platesConfig.js';
import { achievementContext } from '../state/selectors.js';
import { isCollectionComplete } from '../state/gameState.js';
import { sound } from '../utils/soundEngine.js';
import { money, moneyShort } from '../utils/format.js';

/** Число невостребованных наград — для бейджа на вкладке. */
export function countUnclaimed(state) {
  const a = ACHIEVEMENTS.filter((x) => state.achievements.unlocked[x.id] && !state.achievements.claimed[x.id]).length;
  const c = COLLECTIONS.filter((x) => !state.collectionsClaimed[x.id] && isCollectionComplete(state, x)).length;
  return a + c;
}

export default function Achievements({ state, dispatch, notify }) {
  const ctx = achievementContext(state, Date.now());
  const unlockedCount = ACHIEVEMENTS.filter((a) => state.achievements.unlocked[a.id]).length;

  const claimable = useMemo(
    () => ({
      achievements: ACHIEVEMENTS.filter((a) => state.achievements.unlocked[a.id] && !state.achievements.claimed[a.id]),
      collections: COLLECTIONS.filter((c) => !state.collectionsClaimed[c.id] && isCollectionComplete(state, c)),
    }),
    [state],
  );
  const claimableSum =
    claimable.achievements.reduce((s, a) => s + a.reward, 0) + claimable.collections.reduce((s, c) => s + c.reward, 0);

  const claimAll = () => {
    claimable.achievements.forEach((a) => dispatch({ type: 'CLAIM_ACHIEVEMENT', id: a.id }));
    claimable.collections.forEach((c) => dispatch({ type: 'CLAIM_COLLECTION', id: c.id }));
    sound.coin(4);
    notify({ kind: 'success', title: 'Награды получены', text: `+${money(claimableSum)}` });
  };

  const claim = (type, id, reward) => {
    dispatch({ type, id });
    sound.coin(3);
    notify({ kind: 'success', title: 'Награда получена', text: `+${money(reward)}` });
  };

  const { stats } = state;

  return (
    <div className="space-y-8">
      <Card className="flex flex-col items-start justify-between gap-4 p-4 sm:flex-row sm:items-center">
        <div>
          <div className="font-display text-2xl font-semibold">
            {unlockedCount} / {ACHIEVEMENTS.length} <span className="text-base font-normal text-zinc-400">достижений</span>
          </div>
          <ProgressBar value={unlockedCount} max={ACHIEVEMENTS.length} color="bg-amber-400" className="mt-2 w-64 max-w-full" />
        </div>
        <Button variant="gold" disabled={claimableSum === 0} onClick={claimAll}>
          <Gift className="h-4 w-4" /> Забрать всё {claimableSum > 0 && `· ${money(claimableSum)}`}
        </Button>
      </Card>

      <section>
        <SectionTitle icon={Trophy}>Достижения</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = Boolean(state.achievements.unlocked[a.id]);
            const claimed = Boolean(state.achievements.claimed[a.id]);
            const [cur, target] = a.progress(ctx);
            return (
              <Card key={a.id} className={`flex gap-3 p-3 ${unlocked ? (claimed ? 'border-emerald-500/20' : 'border-amber-400/50') : 'opacity-80'}`}>
                <div className={`h-fit rounded-xl p-2.5 ${unlocked ? 'bg-amber-500/15 text-amber-300' : 'bg-zinc-800 text-zinc-600'}`}>
                  {unlocked ? <Icon name={a.icon} className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate font-semibold">{a.name}</h3>
                    <span className="whitespace-nowrap text-xs text-amber-300">{moneyShort(a.reward)}</span>
                  </div>
                  <p className="text-xs text-zinc-400">{a.description}</p>
                  {!unlocked && target > 1 && (
                    <div className="mt-2">
                      <ProgressBar value={cur} max={target} color="bg-sky-500" />
                      <div className="mt-1 text-[11px] text-zinc-500">
                        {Math.floor(Math.min(cur, target)).toLocaleString('ru-RU')} / {target.toLocaleString('ru-RU')}
                      </div>
                    </div>
                  )}
                  {unlocked && !claimed && (
                    <Button variant="gold" size="sm" className="mt-2" onClick={() => claim('CLAIM_ACHIEVEMENT', a.id, a.reward)}>
                      <Gift className="h-3.5 w-3.5" /> Забрать {money(a.reward)}
                    </Button>
                  )}
                  {claimed && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
                      <Check className="h-3.5 w-3.5" /> Награда получена
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle icon={Layers}>Коллекции</SectionTitle>
        <p className="-mt-1 mb-3 text-sm text-zinc-500">Номер засчитывается в коллекцию в момент выпадения — даже если потом его продать.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {COLLECTIONS.map((c) => {
            const found = state.discovered[c.id] ?? {};
            const have = c.items.filter((k) => found[k]).length;
            const complete = have === c.items.length;
            const claimed = Boolean(state.collectionsClaimed[c.id]);
            return (
              <Card key={c.id} className={`p-4 ${complete ? (claimed ? 'border-emerald-500/30' : 'border-amber-400/60') : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`rounded-xl p-2.5 ${complete ? 'bg-amber-500/15 text-amber-300' : 'bg-sky-500/10 text-sky-300'}`}>
                    <Icon name={c.icon} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-semibold uppercase tracking-wide">{c.name}</h3>
                      <span className="whitespace-nowrap text-xs text-zinc-400">
                        {have}/{c.items.length}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">{c.description}</p>
                  </div>
                </div>
                <ProgressBar value={have} max={c.items.length} color={complete ? 'bg-amber-400' : 'bg-sky-500'} className="mt-3" />
                {c.compact ? (
                  <p className="mt-3 text-xs text-zinc-500">
                    {have > 0 ? `Найдено: ${c.items.filter((k) => found[k]).slice(-6).join(', ')}${have > 6 ? '…' : ''}` : 'Пока ничего не найдено'}
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.items.map((k) => (
                      <span
                        key={k}
                        className={`rounded-md border px-2 py-0.5 font-mono text-xs ${found[k] ? 'border-sky-400/50 bg-sky-500/15 text-sky-100' : 'border-white/5 bg-zinc-800/60 text-zinc-600'}`}
                      >
                        {found[k] ? k : '???'}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-amber-300">Награда: {money(c.reward)}</span>
                  {complete && !claimed && (
                    <Button variant="gold" size="sm" onClick={() => claim('CLAIM_COLLECTION', c.id, c.reward)}>
                      <Gift className="h-3.5 w-3.5" /> Забрать
                    </Button>
                  )}
                  {claimed && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <Check className="h-3.5 w-3.5" /> Получено
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle icon={ChartColumn}>Статистика</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Прокрутов" value={stats.spins.toLocaleString('ru-RU')} sub={`VIP: ${stats.vipSpins.toLocaleString('ru-RU')}`} />
          <StatTile label="Продано номеров" value={stats.sold.toLocaleString('ru-RU')} sub={`выручка ${moneyShort(stats.earned)}`} />
          <StatTile label="Госпошлины" value={moneyShort(stats.spent)} sub={`магазин ${moneyShort(stats.shopSpent)}`} />
          <StatTile label="Аренда и награды" value={moneyShort(stats.passiveEarned + stats.rewards)} sub={`аренда ${moneyShort(stats.passiveEarned)}`} />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Card className="p-4">
            <div className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Выпало по редкости</div>
            <div className="space-y-2">
              {TIERS.map((t) => {
                const n = stats.tierCounts[t.id] ?? 0;
                return (
                  <div key={t.id} className="flex items-center gap-3 text-sm">
                    <span className={`w-28 ${t.text}`}>{t.name}</span>
                    <ProgressBar value={n} max={Math.max(1, stats.spins)} className="flex-1" color="bg-zinc-500" />
                    <span className="w-16 text-right text-zinc-300">{n.toLocaleString('ru-RU')}</span>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card className="p-4">
            <div className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Самый дорогой номер</div>
            {stats.bestPlate ? (
              <div className="space-y-3">
                <LicensePlate {...stats.bestPlate} frame={state.frames.active} />
                <div className="flex items-center justify-between">
                  <RarityBadge tier={stats.bestPlate.tier} size="sm" />
                  <span className="font-display text-lg font-semibold">{money(stats.bestPlate.value)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Ещё ничего не выпало.</p>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
