import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, Gift, Megaphone, PackageMinus, RefreshCw, Search, Shield, ShieldCheck, Users, Wallet } from 'lucide-react';
import LicensePlate from './LicensePlate.jsx';
import RegionSelect from './RegionSelect.jsx';
import { Button, Card, RarityBadge, SectionTitle, StatTile } from './ui.jsx';
import { api } from '../api/http.js';
import { evaluatePlate, formatPlate, getTier, normalizeLetters } from '../utils/plateEvaluator.js';
import { sound } from '../utils/soundEngine.js';
import { money, moneyShort } from '../utils/format.js';

const POLL_MS = 5000;
const field = 'h-10 w-full rounded-xl border border-white/10 bg-zinc-800 px-3 text-sm text-zinc-100 outline-none focus:border-sky-400';

function useAdminAction(notify, reload) {
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (path, body) => {
      setBusy(true);
      try {
        const res = await api(`/admin/${path}`, { method: 'POST', body });
        notify({ kind: 'success', title: 'Готово', text: res.message });
        sound.purchase();
        await reload();
        return res;
      } catch (err) {
        notify({ kind: 'error', title: 'Не получилось', text: err.message });
        sound.error();
        return null;
      } finally {
        setBusy(false);
      }
    },
    [notify, reload],
  );
  return [run, busy];
}

function Broadcast({ run, busy }) {
  const [message, setMessage] = useState('');
  return (
    <Card className="p-4">
      <SectionTitle icon={Megaphone}>Объявление всем онлайн</SectionTitle>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="Например: «Через 10 минут — двойная удача для всех!»"
        className="w-full resize-none rounded-xl border border-white/10 bg-zinc-800 p-3 text-sm text-zinc-100 outline-none focus:border-sky-400"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-600">{message.length}/500</span>
        <Button
          variant="primary"
          disabled={busy || !message.trim()}
          onClick={async () => {
            if (await run('broadcast', { message })) setMessage('');
          }}
        >
          <Megaphone className="h-4 w-4" /> Отправить на весь экран
        </Button>
      </div>
    </Card>
  );
}

function GivePlate({ target, me, run, busy }) {
  const [letters, setLetters] = useState('АМР');
  const [digits, setDigits] = useState('001');
  const [region, setRegion] = useState('97');
  const [price, setPrice] = useState('');

  const valid = letters.length === 3 && /^\d{1,3}$/.test(digits) && Number(digits) > 0;
  const preview = useMemo(() => {
    if (!valid) return null;
    const ev = evaluatePlate({ letters, digits: digits.padStart(3, '0'), region });
    const custom = Number(price);
    return price && custom >= 10 ? { ...ev, value: Math.round(custom), tier: getTier(custom) } : ev;
  }, [valid, letters, digits, region, price]);

  const give = (userId) => run('give-plate', { userId, letters, digits: digits.padStart(3, '0'), region, value: price || undefined });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_1fr_1.6fr] gap-2">
        <input className={`${field} text-center font-display uppercase tracking-widest`} value={letters} maxLength={3} onChange={(e) => setLetters(normalizeLetters(e.target.value).slice(0, 3))} placeholder="АМР" aria-label="Буквы" />
        <input className={`${field} text-center font-display tracking-widest`} value={digits} maxLength={3} inputMode="numeric" onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="001" aria-label="Цифры" />
        <RegionSelect value={region} onChange={setRegion} />
      </div>
      <input className={field} value={price} inputMode="numeric" onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 13))} placeholder="Своя цена, ₽ (необязательно — иначе по формуле)" />
      {preview ? (
        <div className="space-y-2">
          <LicensePlate letters={letters} digits={digits.padStart(3, '0')} region={region} tier={preview.tier} frame={null} />
          <div className="flex items-center justify-between">
            <RarityBadge tier={preview.tier} size="sm" />
            <span className="font-display font-semibold text-zinc-100">{money(preview.value)}</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">3 буквы ГОСТ и цифры 001–999</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="gold" disabled={busy || !preview} onClick={() => give(target.id)}>
          <Gift className="h-4 w-4" /> Выдать {target.username}
        </Button>
        <Button variant="ghost" disabled={busy || !preview || target.id === me.id} onClick={() => give(me.id)}>
          Выдать себе
        </Button>
      </div>
    </div>
  );
}

function UserDetails({ target, me, run, busy }) {
  const [balance, setBalance] = useState(String(Math.floor(target.balance)));
  const [reason, setReason] = useState('');
  useEffect(() => setBalance(String(Math.floor(target.balance))), [target.id, target.balance]);

  const quick = [
    ['+100 тыс', target.balance + 1e5],
    ['+1 млн', target.balance + 1e6],
    ['+10 млн', target.balance + 1e7],
    ['Обнулить', 0],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${target.online ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
        <h3 className="font-display text-xl font-semibold">{target.username}</h3>
        {target.role === 'admin' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300">
            <Shield className="h-3 w-3" /> admin
          </span>
        )}
        {target.isBanned && <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">ЗАБАНЕН</span>}
        <span className="ml-auto text-xs text-zinc-500">{target.online ? 'онлайн' : `был ${new Date(target.lastSeen).toLocaleString('ru-RU')}`}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Баланс" value={moneyShort(target.balance)} />
        <StatTile label="Гараж" value={moneyShort(target.garageValue)} sub={`${target.garage.length} номеров`} />
        <StatTile label="Прокрутов" value={target.spins.toLocaleString('ru-RU')} />
      </div>

      <section>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-300">
          <Wallet className="h-4 w-4 text-emerald-400" /> Баланс
        </div>
        <div className="flex gap-2">
          <input className={field} value={balance} inputMode="numeric" onChange={(e) => setBalance(e.target.value.replace(/\D/g, '').slice(0, 15))} />
          <Button variant="success" disabled={busy || balance === ''} onClick={() => run('set-balance', { userId: target.id, balance: Number(balance) })}>
            Применить
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {quick.map(([label, value]) => (
            <Button key={label} variant="subtle" size="sm" disabled={busy} onClick={() => run('set-balance', { userId: target.id, balance: Math.floor(value) })}>
              {label}
            </Button>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-300">
          <Gift className="h-4 w-4 text-amber-400" /> Выдать кастомный номер
        </div>
        <GivePlate target={target} me={me} run={run} busy={busy} />
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-300">
          <Ban className="h-4 w-4 text-red-400" /> Блокировка
        </div>
        {target.isBanned ? (
          <div className="space-y-2">
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">Причина: {target.banReason}</p>
            <Button variant="success" className="w-full" disabled={busy} onClick={() => run('ban', { userId: target.id, banned: false })}>
              <ShieldCheck className="h-4 w-4" /> Разблокировать
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input className={field} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Причина бана" />
            <Button
              variant="danger"
              disabled={busy || target.id === me.id}
              onClick={async () => {
                if (await run('ban', { userId: target.id, banned: true, reason })) setReason('');
              }}
            >
              Забанить
            </Button>
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-300">
          <PackageMinus className="h-4 w-4 text-sky-400" /> Гараж игрока
        </div>
        {target.garage.length === 0 ? (
          <p className="text-sm text-zinc-500">Пусто</p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {[...target.garage]
              .sort((a, b) => b.value - a.value)
              .map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <div className="w-28 shrink-0">
                    <LicensePlate letters={p.letters} digits={p.digits} region={p.region} frame={null} glow={false} />
                  </div>
                  <div className="min-w-0 flex-1 text-xs">
                    <RarityBadge tier={p.tier} size="sm" />
                    <div className="mt-0.5 text-zinc-400">{money(p.value)}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || target.id === me.id}
                    onClick={() => run('confiscate', { userId: target.id, plateId: p.id })}
                    title={`Забрать ${formatPlate(p)} себе`}
                  >
                    Изъять
                  </Button>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function AdminPanel({ me, notify }) {
  const [users, setUsers] = useState([]);
  const [online, setOnline] = useState(0);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const data = await api('/admin/users');
      setUsers(data.users);
      setOnline(data.online);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    reload();
    const id = setInterval(reload, POLL_MS);
    return () => clearInterval(id);
  }, [reload]);

  const [run, busy] = useAdminAction(notify, reload);

  const filtered = users.filter((u) => u.username.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = users.find((u) => u.id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
        <Shield className="h-4 w-4" /> Админ-панель. Все действия мгновенно доходят до игроков.
      </div>
      {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="space-y-5">
          <Card className="p-4">
            <SectionTitle
              icon={Users}
              right={
                <Button variant="ghost" size="sm" onClick={reload}>
                  <RefreshCw className="h-3.5 w-3.5" /> {online} онлайн
                </Button>
              }
            >
              Игроки · {users.length}
            </SectionTitle>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input className={`${field} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по нику" />
            </div>
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                    <th className="py-2">Игрок</th>
                    <th className="py-2 text-right">Баланс</th>
                    <th className="py-2 text-right">Гараж</th>
                    <th className="py-2 text-right">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedId(u.id)}
                      className={`cursor-pointer border-t border-white/5 transition hover:bg-white/5 ${u.id === selectedId ? 'bg-sky-500/10' : ''}`}
                    >
                      <td className="py-2">
                        <span className="flex items-center gap-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${u.online ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
                          <span className="font-semibold text-zinc-100">{u.username}</span>
                          {u.role === 'admin' && <Shield className="h-3.5 w-3.5 text-red-400" />}
                          {u.id === me.id && <span className="text-xs text-sky-300">(вы)</span>}
                        </span>
                      </td>
                      <td className="py-2 text-right text-emerald-300">{moneyShort(u.balance)}</td>
                      <td className="py-2 text-right text-zinc-400">
                        {u.garage.length} · {moneyShort(u.garageValue)}
                      </td>
                      <td className="py-2 text-right">
                        {u.isBanned ? <span className="text-xs font-bold text-red-400">бан</span> : <span className="text-xs text-zinc-500">{u.online ? 'играет' : 'офлайн'}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Broadcast run={run} busy={busy} />
        </div>

        <Card className="h-fit p-4 lg:sticky lg:top-32">
          {selected ? (
            <UserDetails key={selected.id} target={selected} me={me} run={run} busy={busy} />
          ) : (
            <p className="py-10 text-center text-sm text-zinc-500">Выберите игрока в списке слева</p>
          )}
        </Card>
      </div>
    </div>
  );
}
