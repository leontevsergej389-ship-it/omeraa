import { useCallback, useEffect, useState } from 'react';
import { sound } from '../utils/soundEngine.js';

// Звук — настройка конкретного устройства, а не аккаунта, поэтому живёт в localStorage.
const KEY = 'namerki-prefs';
const DEFAULTS = { sound: true, volume: 0.6 };

function read() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

export function usePrefs() {
  const [prefs, setPrefs] = useState(read);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      // настройки звука не запомнятся — не страшно
    }
    sound.setEnabled(prefs.sound);
    sound.setVolume(prefs.volume);
  }, [prefs]);

  const setPref = useCallback((key, value) => setPrefs((p) => ({ ...p, [key]: value })), []);
  return [prefs, setPref];
}
