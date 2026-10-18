// Синтезатор игровых звуков на Web Audio API — без единого аудиофайла.

let ctx = null;
let master = null;
let noiseBuffer = null;
let enabled = true;
let volume = 0.6;

function getCtx() {
  if (!enabled || typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 6;
    master.connect(compressor);
    compressor.connect(ctx.destination);

    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Один тон с огибающей. Время — в секундах от «сейчас». */
function tone({ freq, freqEnd, type = 'sine', start = 0, dur = 0.15, gain = 0.25, attack = 0.004, filter, vibrato }) {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);

  if (vibrato) {
    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    lfo.frequency.value = vibrato.rate;
    lfoGain.gain.value = vibrato.depth;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.05);
  }

  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  let node = osc;
  if (filter) {
    const f = ac.createBiquadFilter();
    f.type = filter.type ?? 'lowpass';
    f.frequency.setValueAtTime(filter.from ?? filter.freq, t0);
    if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, t0 + dur * 0.6);
    f.Q.value = filter.q ?? 1;
    node.connect(f);
    node = f;
  }
  node.connect(amp).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** Короткий шумовой всплеск (щелчок, шорох). */
function noise({ start = 0, dur = 0.03, gain = 0.2, freq = 3000, q = 1.5, type = 'bandpass' }) {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime + start;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const amp = ac.createGain();
  amp.gain.setValueAtTime(gain, t0);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(amp).connect(master);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.02);
}

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12); // MIDI → Гц

function brass(midi, start, dur, gain = 0.12) {
  tone({ freq: NOTE(midi), type: 'sawtooth', start, dur, gain, attack: 0.02, filter: { from: 700, to: 3200, q: 2 } });
  tone({ freq: NOTE(midi) * 1.005, type: 'square', start, dur, gain: gain * 0.35, attack: 0.02, filter: { freq: 1800 } });
}

function chime(midi, start, dur = 0.9, gain = 0.12) {
  tone({ freq: NOTE(midi), type: 'sine', start, dur, gain, attack: 0.002 });
  tone({ freq: NOTE(midi) * 2.01, type: 'sine', start, dur: dur * 0.6, gain: gain * 0.4, attack: 0.002 });
  tone({ freq: NOTE(midi) * 3.02, type: 'triangle', start, dur: dur * 0.3, gain: gain * 0.15, attack: 0.002 });
}

export const sound = {
  setEnabled(value) {
    enabled = value;
    if (!value && ctx) ctx.suspend();
    if (value && ctx) ctx.resume();
  },
  setVolume(value) {
    volume = value;
    if (master) master.gain.value = value;
  },
  /** Разблокирует аудио на первом жесте пользователя (требование браузеров). */
  unlock() {
    getCtx();
  },

  /** Щелчок трещотки при перещёлкивании символов. */
  tick() {
    const pitch = 0.85 + Math.random() * 0.3;
    noise({ dur: 0.018, gain: 0.22, freq: 3200 * pitch, q: 3 });
    tone({ freq: 1500 * pitch, type: 'square', dur: 0.012, gain: 0.04 });
  },

  /** Символ встал на место. */
  lock() {
    noise({ dur: 0.04, gain: 0.25, freq: 1400, q: 2 });
    tone({ freq: 520, freqEnd: 260, type: 'square', dur: 0.05, gain: 0.07 });
  },

  /** Звон монет при продаже; size 1–3 — длина «дождя». */
  coin(size = 1) {
    const count = Math.max(1, Math.min(6, Math.round(size)));
    for (let i = 0; i < count; i++) {
      const s = i * 0.07;
      tone({ freq: NOTE(83), type: 'square', start: s, dur: 0.07, gain: 0.07, filter: { freq: 5000 } });
      tone({ freq: NOTE(88), type: 'square', start: s + 0.06, dur: 0.28, gain: 0.07, filter: { freq: 5000 } });
    }
  },

  /** Покупка в магазине: «ка-чинг». */
  purchase() {
    noise({ dur: 0.08, gain: 0.25, freq: 900, q: 0.8 });
    [72, 76, 79, 84].forEach((n, i) => tone({ freq: NOTE(n), type: 'triangle', start: 0.05 + i * 0.06, dur: 0.22, gain: 0.14 }));
    tone({ freq: NOTE(96), type: 'sine', start: 0.3, dur: 0.5, gain: 0.08 });
  },

  /** Звук открытия номера по тиру. */
  reveal(tier) {
    switch (tier) {
      case 'uncommon':
        tone({ freq: NOTE(76), type: 'triangle', dur: 0.14, gain: 0.14 });
        tone({ freq: NOTE(81), type: 'triangle', start: 0.09, dur: 0.25, gain: 0.14 });
        break;
      case 'rare':
        [84, 88, 91].forEach((n, i) => chime(n, i * 0.08, 0.6, 0.1));
        noise({ start: 0.2, dur: 0.35, gain: 0.05, freq: 9000, q: 0.7, type: 'highpass' });
        break;
      case 'epic':
        sound.fanfareEpic();
        break;
      case 'legendary':
        sound.fanfareLegendary();
        break;
      default:
        tone({ freq: NOTE(69), freqEnd: NOTE(72), type: 'sine', dur: 0.1, gain: 0.08 });
    }
  },

  fanfareEpic() {
    const seq = [[67, 0, 0.12], [72, 0.12, 0.12], [76, 0.24, 0.12], [79, 0.36, 0.7]];
    seq.forEach(([n, s, d]) => brass(n, s, d));
    brass(72, 0.36, 0.7, 0.08);
    brass(76, 0.36, 0.7, 0.08);
    [91, 95, 98].forEach((n, i) => chime(n, 0.4 + i * 0.07, 0.8, 0.06));
  },

  fanfareLegendary() {
    const seq = [[60, 0, 0.14], [67, 0.14, 0.14], [72, 0.28, 0.14], [76, 0.42, 0.14], [79, 0.56, 0.2], [76, 0.76, 0.12], [79, 0.88, 1.1]];
    seq.forEach(([n, s, d]) => brass(n, s, d, 0.13));
    [72, 76, 84].forEach((n) => brass(n, 0.88, 1.1, 0.07));
    tone({ freq: NOTE(48), type: 'sawtooth', start: 0.88, dur: 1.1, gain: 0.08, filter: { freq: 400 } });
    for (let i = 0; i < 10; i++) chime(88 + ((i * 5) % 14), 0.9 + i * 0.06, 0.6, 0.05);
    noise({ start: 0.88, dur: 1.0, gain: 0.06, freq: 8000, q: 0.5, type: 'highpass' });
  },

  achievement() {
    [79, 84, 88, 91].forEach((n, i) => chime(n, i * 0.09, 1.0, 0.1));
  },

  error() {
    tone({ freq: 160, type: 'square', dur: 0.09, gain: 0.08, filter: { freq: 900 } });
    tone({ freq: 120, type: 'square', start: 0.11, dur: 0.14, gain: 0.08, filter: { freq: 900 } });
  },

  click() {
    noise({ dur: 0.015, gain: 0.12, freq: 2500, q: 2 });
  },

  /** Сирена экрана блокировки: «вой» 650 ↔ 1300 Гц. Возвращает функцию, которая глушит её досрочно. */
  siren(duration = 6) {
    const ac = getCtx();
    if (!ac) return () => {};
    const t0 = ac.currentTime;
    const period = 1.1;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    const amp = ac.createGain();
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(0.14, t0 + 0.12);
    amp.gain.setValueAtTime(0.14, t0 + duration - 0.4);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    filter.connect(amp).connect(master);

    const oscs = ['sawtooth', 'square'].map((type, i) => {
      const osc = ac.createOscillator();
      osc.type = type;
      osc.detune.value = i * 9;
      osc.frequency.setValueAtTime(650, t0);
      for (let t = 0; t < duration; t += period) {
        osc.frequency.linearRampToValueAtTime(1300, t0 + t + period / 2);
        osc.frequency.linearRampToValueAtTime(650, t0 + t + period);
      }
      osc.connect(filter);
      osc.start(t0);
      osc.stop(t0 + duration + 0.05);
      return osc;
    });

    return () => {
      const now = ac.currentTime;
      amp.gain.cancelScheduledValues(now);
      amp.gain.setValueAtTime(amp.gain.value, now);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
      oscs.forEach((o) => o.stop(now + 0.2));
    };
  },

  /** Короткий сигнал «кто-то выбил редкий номер». */
  ping(tier = 'epic') {
    const top = tier === 'legendary' ? 91 : 88;
    chime(top - 7, 0, 0.5, 0.07);
    chime(top, 0.09, 0.7, 0.07);
  },

  /** Гонг перед системным объявлением. */
  announce() {
    chime(76, 0, 1.2, 0.14);
    chime(72, 0.35, 1.4, 0.14);
    tone({ freq: NOTE(48), type: 'sine', start: 0, dur: 1.4, gain: 0.08 });
  },
};
