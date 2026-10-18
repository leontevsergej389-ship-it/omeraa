import AuthScreen from './components/AuthScreen.jsx';
import Game from './Game.jsx';
import { useAuth } from './hooks/useAuth.js';

export default function App() {
  const { token, authenticate, logout } = useAuth();
  if (!token) return <AuthScreen onAuth={authenticate} />;
  // key: при смене аккаунта вся игровая сессия создаётся заново.
  return <Game key={token} token={token} onLogout={logout} />;
}
