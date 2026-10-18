import { useState } from 'react';
import { KeyRound, LogIn, User, UserPlus } from 'lucide-react';
import LicensePlate from './LicensePlate.jsx';
import { Button, Card } from './ui.jsx';
import { sound } from '../utils/soundEngine.js';

const SHOWCASE = [
  { letters: 'АМР', digits: '001', region: '97', tier: 'legendary', frame: 'gold' },
  { letters: 'ЕКХ', digits: '777', region: '77', tier: 'legendary', frame: 'fso' },
  { letters: 'ООО', digits: '100', region: '78', tier: 'epic', frame: 'carbon' },
];

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showcase] = useState(() => SHOWCASE[Math.floor(Math.random() * SHOWCASE.length)]);

  const submit = async (e) => {
    e.preventDefault();
    sound.unlock();
    if (mode === 'register' && password !== password2) {
      setError('Пароли не совпадают');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onAuth(mode, username.trim(), password);
      sound.purchase();
    } catch (err) {
      setError(err.message);
      sound.error();
      setLoading(false);
    }
  };

  const input =
    'h-11 w-full rounded-xl border border-white/10 bg-zinc-800 pl-10 pr-3 text-sm text-zinc-100 outline-none transition focus:border-sky-400';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <div className="w-full max-w-md text-center">
        <h1 className="font-display text-4xl font-bold uppercase tracking-wider">Номера РФ</h1>
        <p className="mt-1 text-sm text-zinc-400">Генератор госномеров · общая таблица лидеров · живая лента дропа</p>
        <div className="mx-auto mt-6 max-w-sm">
          <LicensePlate {...showcase} />
        </div>
      </div>

      <Card className="w-full max-w-md p-5">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-zinc-800/70 p-1">
          {[
            ['login', 'Вход', LogIn],
            ['register', 'Регистрация', UserPlus],
          ].map(([id, label, IconCmp]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setMode(id);
                setError('');
              }}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${mode === id ? 'bg-sky-500 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <IconCmp className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="relative block">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              className={input}
              placeholder="Никнейм"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              required
            />
          </label>
          <label className="relative block">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              className={input}
              type="password"
              placeholder="Пароль"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={72}
              required
            />
          </label>
          {mode === 'register' && (
            <label className="relative block">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                className={input}
                type="password"
                placeholder="Повторите пароль"
                autoComplete="new-password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                maxLength={72}
                required
              />
            </label>
          )}
          {mode === 'register' && <p className="text-xs text-zinc-500">Ник: 3–20 символов (буквы, цифры, «_», «-»). Пароль: от 6 символов.</p>}
          {error && <p className="animate-shake rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
            {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
