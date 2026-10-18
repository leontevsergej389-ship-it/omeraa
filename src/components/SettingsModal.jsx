import { useState } from 'react';
import { Keyboard, LogOut, RotateCcw, Shield, Ticket, TriangleAlert, User } from 'lucide-react';
import { Button, Modal, Toggle } from './ui.jsx';
import { sound } from '../utils/soundEngine.js';

export default function SettingsModal({ open, onClose, state, dispatch, prefs, setPref, user, onPromo, onLogout }) {
  const [confirming, setConfirming] = useState(false);
  const [code, setCode] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);

  const close = () => {
    setConfirming(false);
    onClose();
  };

  const submitPromo = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setPromoBusy(true);
    if (await onPromo(code)) setCode('');
    setPromoBusy(false);
  };

  return (
    <Modal open={open} onClose={close} title="Настройки">
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl bg-zinc-800/60 p-3">
          <div className="rounded-full bg-sky-500/15 p-2 text-sky-300">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{user.username}</div>
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              {user.role === 'admin' ? (
                <>
                  <Shield className="h-3 w-3 text-red-400" /> администратор
                </>
              ) : (
                'игрок'
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4" /> Выйти
          </Button>
        </div>

        <form onSubmit={submitPromo}>
          <label className="mb-1 flex items-center gap-1.5 text-sm text-zinc-300">
            <Ticket className="h-4 w-4 text-amber-400" /> Промокод
          </label>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={64}
              placeholder="Введите промокод"
              className="h-10 w-full rounded-xl border border-white/10 bg-zinc-800 px-3 text-sm text-zinc-100 outline-none focus:border-sky-400"
            />
            <Button type="submit" variant="gold" disabled={promoBusy || !code.trim()}>
              Активировать
            </Button>
          </div>
        </form>

        <Toggle checked={prefs.sound} onChange={(v) => setPref('sound', v)} label="Звук" description="Трещотка, монеты, фанфары, сирена" />
        <label className="block">
          <span className="mb-1 flex justify-between text-sm text-zinc-300">
            Громкость <span className="text-zinc-500">{Math.round(prefs.volume * 100)}%</span>
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={prefs.volume}
            disabled={!prefs.sound}
            onChange={(e) => setPref('volume', Number(e.target.value))}
            onPointerUp={() => sound.coin(1)}
            className="w-full"
          />
        </label>
        <Toggle
          checked={state.settings.fastSpin}
          onChange={(v) => dispatch({ type: 'SET_SETTING', key: 'fastSpin', value: v })}
          label="Быстрая прокрутка"
          description="Результат сразу, без анимации барабана"
        />

        <div className="rounded-xl bg-zinc-800/50 p-3 text-xs text-zinc-400">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-zinc-300">
            <Keyboard className="h-4 w-4" /> Горячие клавиши
          </div>
          <kbd className="rounded bg-zinc-700 px-1.5 py-0.5 text-zinc-200">Пробел</kbd> — крутить на вкладке «Генератор»
        </div>

        <div className="text-xs text-zinc-500">Прогресс хранится на сервере и доступен с любого устройства после входа.</div>

        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
          {confirming ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm text-rose-200">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                Баланс, гараж, улучшения и достижения этого аккаунта будут удалены без возможности восстановления.
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" onClick={() => setConfirming(false)}>
                  Отмена
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    dispatch({ type: 'RESET' });
                    close();
                  }}
                >
                  Да, сбросить
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" className="w-full text-rose-300" onClick={() => setConfirming(true)}>
              <RotateCcw className="h-4 w-4" /> Сбросить прогресс
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
