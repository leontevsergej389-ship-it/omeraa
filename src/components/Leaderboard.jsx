import { useCallback, useEffect, useState } from 'react';
import { Crown, Medal, RefreshCw, Shield, Sparkles, Trophy, Users } from 'lucide-react';
import LicensePlate from './LicensePlate.jsx';
import { Button, Card, SectionTitle, StatTile } from './ui.jsx';
import { TIER_BY_ID } from '../data/platesConfig.js';
import { api } from '../api/http.js';
import { formatPlate } from '../utils/plateEvaluator.js';
import { moneyShort } from '../utils/format.js';

const REFRESH_MS = 10_000;
const PODIUM = ['text-amber-300', 'text-zinc-300', 'text-orange-400'];

function timeAgo(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s} с назад`;
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  return `${Math.floor(s / 3600)} ч назад`;
}

export default function Leaderboard({ me, drops, online }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api('/leaderboard'));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <StatTile icon={Trophy} label="Ваше место" value={data?.me.rank ? `#${data.me.rank}` : '—'} sub={data ? `из ${data.totalPlayers}` : ''} accent="text-amber-400" />
          <StatTile icon={Crown} label="Ваш капитал" value={data ? moneyShort(data.me.netWorth) : '—'} sub="баланс + гараж" accent="text-emerald-400" />
          <StatTile icon={Users} label="Онлайн" value={online} sub="игроков сейчас" accent="text-sky-400" />
        </div>

        <Card className="p-4">
          <SectionTitle
            icon={Trophy}
            right={
              <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Обновить
              </Button>
            }
          >
            Таблица лидеров
          </SectionTitle>
          {error && <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}
          {!data ? (
            <p className="py-8 text-center text-sm text-zinc-500">Загружаем рейтинг…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                    <th className="w-12 py-2">#</th>
                    <th className="py-2">Игрок</th>
                    <th className="py-2 text-right">Капитал</th>
                    <th className="hidden py-2 text-right sm:table-cell">Гараж</th>
                    <th className="py-2 text-center">Легенд</th>
                    <th className="py-2 pl-3">Лучший номер</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top.map((p) => (
                    <tr key={p.id} className={`border-t border-white/5 ${p.id === me.id ? 'bg-sky-500/10' : ''}`}>
                      <td className="py-2 font-display text-base font-semibold">
                        {p.rank <= 3 ? <Medal className={`h-5 w-5 ${PODIUM[p.rank - 1]}`} /> : <span className="text-zinc-500">{p.rank}</span>}
                      </td>
                      <td className="py-2">
                        <span className="flex items-center gap-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${p.online ? 'bg-emerald-400' : 'bg-zinc-700'}`} title={p.online ? 'онлайн' : 'офлайн'} />
                          <span className="truncate font-semibold text-zinc-100">{p.username}</span>
                          {p.role === 'admin' && <Shield className="h-3.5 w-3.5 shrink-0 text-red-400" title="Администратор" />}
                          {p.id === me.id && <span className="text-xs text-sky-300">(вы)</span>}
                        </span>
                      </td>
                      <td className="py-2 text-right font-semibold text-emerald-300">{moneyShort(p.netWorth)}</td>
                      <td className="hidden py-2 text-right text-zinc-400 sm:table-cell">
                        {p.garageCount} шт · {moneyShort(p.garageValue)}
                      </td>
                      <td className="py-2 text-center text-amber-300">{p.legendary || '—'}</td>
                      <td className="py-2 pl-3">
                        {p.best ? (
                          <div className="w-28" title={`${formatPlate(p.best)} · ${moneyShort(p.best.value)}`}>
                            <LicensePlate {...p.best} frame={null} glow={false} />
                          </div>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-zinc-600">Капитал = баланс + стоимость всех номеров в гараже. Заблокированные игроки в рейтинг не попадают.</p>
        </Card>
      </div>

      <Card className="h-fit p-4 lg:sticky lg:top-32">
        <SectionTitle icon={Sparkles}>Живая лента дропа</SectionTitle>
        {drops.length === 0 ? (
          <p className="text-sm text-zinc-500">Здесь появятся эпические и легендарные номера всех игроков.</p>
        ) : (
          <ul className="space-y-2.5">
            {drops.map((d) => {
              const t = TIER_BY_ID[d.plate.tier];
              return (
                <li key={d.id} className="animate-slide-up flex items-center gap-3">
                  <div className="w-28 shrink-0">
                    <LicensePlate {...d.plate} frame={null} glow={false} />
                  </div>
                  <div className="min-w-0 text-xs">
                    <div className="truncate font-semibold text-zinc-100">{d.username}</div>
                    <div className={t.text}>
                      {t.name} · {moneyShort(d.plate.value)}
                    </div>
                    <div className="text-zinc-600">{timeAgo(d.at)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
