import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Crown, Dices, LogOut, Shield, Store, Trophy, Warehouse } from 'lucide-react';
import Header, { MobileNav } from './components/Header.jsx';
import SpinnerSection from './components/SpinnerSection.jsx';
import Garage from './components/Garage.jsx';
import UpgradesShop from './components/UpgradesShop.jsx';
import Achievements, { countUnclaimed } from './components/Achievements.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import PriceGuide from './components/PriceGuide.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import Toasts from './components/Toasts.jsx';
import { BanScreen, BroadcastOverlay, ConnectionBanner, GiftModal, LiveDropBanners } from './components/RealtimeOverlays.jsx';
import { Button } from './components/ui.jsx';
import { useServerGame } from './hooks/useServerGame.js';
import { useToasts } from './hooks/useToasts.js';
import { usePrefs } from './hooks/usePrefs.js';
import { api } from './api/http.js';
import { ACHIEVEMENT_BY_ID, COLLECTIONS } from './data/achievementsConfig.js';
import { isCollectionComplete } from './state/gameState.js';
import { sound } from './utils/soundEngine.js';
import { money } from './utils/format.js';

const PLAYER_TABS = [
  { id: 'generator', label: 'Генератор', short: 'Крутить', icon: Dices },
  { id: 'garage', label: 'Гараж', short: 'Гараж', icon: Warehouse },
  { id: 'shop', label: 'Магазин МРЭО', short: 'МРЭО', icon: Store },
  { id: 'achievements', label: 'Достижения', short: 'Награды', icon: Trophy },
  { id: 'leaderboard', label: 'Рейтинг', short: 'Топ', icon: Crown },
  { id: 'guide', label: 'Справочник цен', short: 'Цены', icon: BookOpen },
];
const ADMIN_TAB = { id: 'admin', label: 'Админка', short: 'Админ', icon: Shield };
const TAB_KEY = 'namerki-tab';
const DROP_BANNER_MS = 6000;

function readTab() {
  try {
    return localStorage.getItem(TAB_KEY) ?? 'generator';
  } catch {
    return 'generator';
  }
}

function ConnectingScreen({ status, onLogout }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <Dices className="h-12 w-12 animate-spin text-sky-400" />
      <p className="text-zinc-300">{status === 'offline' ? 'Сервер недоступен — пробуем подключиться…' : 'Подключаемся к серверу…'}</p>
      {status === 'offline' && <p className="max-w-sm text-xs text-zinc-500">Проверьте, что сервер запущен: npm run dev</p>}
      <Button variant="ghost" size="sm" onClick={onLogout}>
        <LogOut className="h-4 w-4" /> Выйти из аккаунта
      </Button>
    </div>
  );
}

/** Сессия игрока: сокет, реалтайм-события и полноэкранные оверлеи поверх игры. */
export default function Game({ token, onLogout }) {
  const { toasts, push, dismiss } = useToasts();
  const [prefs, setPref] = usePrefs();
  const [drops, setDrops] = useState([]);
  const [banners, setBanners] = useState([]);
  const [gift, setGift] = useState(null);
  const [announcement, setAnnouncement] = useState(null);
  const meRef = useRef(null);

  const handleEvent = useCallback(
    (type, payload) => {
      switch (type) {
        case 'session':
          setDrops(payload.drops ?? []);
          if (payload.offline) {
            const minutes = Math.max(1, Math.round(payload.offline.seconds / 60));
            push({ kind: 'success', title: 'Пока вас не было', text: `Аренда номеров за ${minutes} мин принесла ${money(payload.offline.amount)}`, duration: 6000 });
          }
          break;
        case 'drop':
          setDrops((list) => [payload, ...list.filter((d) => d.id !== payload.id)].slice(0, 20));
          if (payload.username !== meRef.current?.username) {
            setBanners((list) => [...list.slice(-2), payload]);
            setTimeout(() => setBanners((list) => list.filter((d) => d.id !== payload.id)), DROP_BANNER_MS);
            sound.ping(payload.plate.tier);
          }
          break;
        case 'gift':
          setGift(payload);
          break;
        case 'unbanned':
          push({ kind: 'success', title: 'Аккаунт разблокирован', text: 'Можно продолжать игру' });
          sound.achievement();
          break;
        case 'broadcast':
          setAnnouncement(payload);
          break;
        case 'notice':
          push({ kind: payload.kind ?? 'info', title: payload.title, text: payload.text, duration: 6000 });
          sound.error();
          break;
        case 'action-error':
          if (!payload.banned) push({ kind: 'error', title: 'Действие отклонено', text: payload.error });
          break;
        case 'unauthorized':
          onLogout();
          break;
        default:
          break;
      }
    },
    [push, onLogout],
  );

  const game = useServerGame(token, handleEvent);
  meRef.current = game.user;

  if (!game.state || !game.user) return <ConnectingScreen status={game.status} onLogout={onLogout} />;

  return (
    <>
      <GameShell game={game} prefs={prefs} setPref={setPref} notify={push} drops={drops} onLogout={onLogout} />
      <Toasts toasts={toasts} onDismiss={dismiss} />
      <LiveDropBanners drops={banners} />
      <ConnectionBanner status={game.status} />
      {announcement && <BroadcastOverlay announcement={announcement} onClose={() => setAnnouncement(null)} />}
      {gift && <GiftModal gift={gift} frame={game.state.frames.active} onClose={() => setGift(null)} />}
      {game.user.isBanned && <BanScreen key={game.user.banReason} reason={game.user.banReason} onLogout={onLogout} />}
    </>
  );
}

function GameShell({ game, prefs, setPref, notify, drops, onLogout }) {
  const { state, dispatch, stateRef, user, online } = game;
  const spinApi = useMemo(() => ({ spin: game.spin, commit: game.commit }), [game.spin, game.commit]);
  const tabs = useMemo(() => (user.role === 'admin' ? [...PLAYER_TABS, ADMIN_TAB] : PLAYER_TABS), [user.role]);
  const [savedTab, setSavedTab] = useState(readTab);
  const tab = tabs.some((t) => t.id === savedTab) ? savedTab : 'generator';
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);

  const changeTab = useCallback((id) => {
    setSavedTab(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      localStorage.setItem(TAB_KEY, id);
    } catch {
      // без запоминания вкладки
    }
  }, []);

  // Браузеры разрешают звук только после жеста пользователя.
  useEffect(() => {
    const unlock = () => sound.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Уведомления о новых достижениях.
  const knownAchievements = useRef(null);
  useEffect(() => {
    const ids = Object.keys(state.achievements.unlocked);
    if (knownAchievements.current) {
      const fresh = ids.filter((id) => !knownAchievements.current.has(id));
      fresh.forEach((id) => {
        const a = ACHIEVEMENT_BY_ID[id];
        notify({ kind: 'achievement', title: `Достижение: ${a.name}`, text: `Награда ${money(a.reward)} ждёт во вкладке «Достижения»`, duration: 5000 });
      });
      if (fresh.length) sound.achievement();
    }
    knownAchievements.current = new Set(ids);
  }, [state.achievements.unlocked, notify]);

  // Уведомления о собранных коллекциях.
  const completedKey = COLLECTIONS.filter((c) => isCollectionComplete(state, c))
    .map((c) => c.id)
    .join(',');
  const knownCollections = useRef(null);
  useEffect(() => {
    const ids = completedKey ? completedKey.split(',') : [];
    if (knownCollections.current) {
      const fresh = ids.filter((id) => !knownCollections.current.has(id));
      fresh.forEach((id) => {
        const c = COLLECTIONS.find((x) => x.id === id);
        notify({ kind: 'achievement', title: `Коллекция собрана: ${c.name}`, text: `Награда ${money(c.reward)}`, duration: 5000 });
      });
      if (fresh.length) sound.achievement();
    }
    knownCollections.current = new Set(ids);
  }, [completedKey, notify]);

  const unclaimed = countUnclaimed(state);
  const badges = useMemo(() => ({ achievements: unclaimed }), [unclaimed]);

  const activatePromo = async (code) => {
    try {
      const res = await api('/promo', { method: 'POST', body: { code } });
      notify({ kind: 'success', title: 'Промокод активирован', text: res.message });
      sound.achievement();
      return true;
    } catch (err) {
      notify({ kind: 'error', title: 'Промокод не принят', text: err.message });
      sound.error();
      return false;
    }
  };

  const common = { state, dispatch, notify, onNavigate: changeTab };

  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <Header
        state={state}
        user={user}
        online={online}
        soundOn={prefs.sound}
        tabs={tabs}
        tab={tab}
        onTab={changeTab}
        autoRunning={autoRunning}
        badges={badges}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleSound={() => setPref('sound', !prefs.sound)}
      />

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        {/* Генератор не размонтируется, чтобы авто-прокрут работал и на других вкладках */}
        <div className={tab === 'generator' ? '' : 'hidden'}>
          <SpinnerSection {...common} api={spinApi} stateRef={stateRef} isActive={tab === 'generator'} onAutoChange={setAutoRunning} />
        </div>
        {tab === 'garage' && <Garage {...common} />}
        {tab === 'shop' && <UpgradesShop {...common} />}
        {tab === 'achievements' && <Achievements {...common} />}
        {tab === 'leaderboard' && <Leaderboard me={user} drops={drops} online={online} />}
        {tab === 'guide' && <PriceGuide />}
        {tab === 'admin' && user.role === 'admin' && <AdminPanel me={user} notify={notify} />}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-6 text-center text-xs text-zinc-600 sm:px-6">
        Игра-симулятор. Номера и цены вымышленные; формат знаков — по ГОСТ Р 50577-2018.
      </footer>

      <MobileNav tabs={tabs} tab={tab} onTab={changeTab} autoRunning={autoRunning} badges={badges} />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        state={state}
        dispatch={dispatch}
        prefs={prefs}
        setPref={setPref}
        user={user}
        onPromo={activatePromo}
        onLogout={onLogout}
      />
    </div>
  );
}
