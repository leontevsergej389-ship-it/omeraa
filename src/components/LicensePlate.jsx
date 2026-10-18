import { useId } from 'react';
import { TIER_BY_ID } from '../data/platesConfig.js';

/*
 * Российский регистрационный знак типа 1 по ГОСТ Р 50577-2018 (520 × 112 мм).
 * Рисуется в SVG в масштабе 1 единица = 1 мм, поэтому пропорции точные на любом размере.
 * Цифры основной части — 58 мм, буквы — 42 мм, все символы стоят на общей базовой линии.
 */

const FONT = "'Roboto Condensed Variable', 'Oswald Variable', 'Arial Narrow', sans-serif";

// Центры символов основной части: Б 000 ББ
const MAIN = [
  { x: 53.5, kind: 'letter' },
  { x: 116.5, kind: 'digit' },
  { x: 173.5, kind: 'digit' },
  { x: 230.5, kind: 'digit' },
  { x: 293.5, kind: 'letter' },
  { x: 344.5, kind: 'letter' },
];
const BASELINE = 89;
const SEPARATOR_X = 393;
const REGION_CX = 454;

// Рамка добавляет поля вокруг таблички: сверху/по бокам 10 мм, снизу 16 мм.
const FRAMED_VIEWBOX = '-10 -10 540 138';
const PLAIN_VIEWBOX = '0 0 520 112';

function Frame({ frame, uid }) {
  const outer = { x: -9.5, y: -9.5, width: 539, height: 137, rx: 14 };
  switch (frame) {
    case 'carbon':
      return (
        <g>
          <defs>
            <pattern id={`${uid}-carbon`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="#141518" />
              <rect width="3" height="3" fill="#2b2d33" />
              <rect x="3" y="3" width="3" height="3" fill="#2b2d33" />
              <rect width="3" height="1" fill="#3a3d45" />
              <rect x="3" y="3" width="3" height="1" fill="#3a3d45" />
            </pattern>
            <linearGradient id={`${uid}-carbon-gloss`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity=".22" />
              <stop offset=".45" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity=".35" />
            </linearGradient>
          </defs>
          <rect {...outer} fill={`url(#${uid}-carbon)`} stroke="#000" strokeWidth="1" />
          <rect {...outer} fill={`url(#${uid}-carbon-gloss)`} />
        </g>
      );
    case 'gold':
      return (
        <g>
          <defs>
            <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff4c2" />
              <stop offset=".22" stopColor="#e6b93c" />
              <stop offset=".45" stopColor="#9a6f12" />
              <stop offset=".62" stopColor="#f6dc7a" />
              <stop offset=".82" stopColor="#b8871d" />
              <stop offset="1" stopColor="#fff0b0" />
            </linearGradient>
          </defs>
          <rect {...outer} fill={`url(#${uid}-gold)`} stroke="#6b4c0b" strokeWidth="1" />
          <rect x="-5" y="-5" width="530" height="128" rx="11" fill="none" stroke="#fff6cf" strokeOpacity=".55" strokeWidth="1" />
          <text x="260" y="124" textAnchor="middle" fontFamily={FONT} fontWeight="700" fontSize="9" letterSpacing="3" fill="#5b3f06" fillOpacity=".8">
            ★ ★ ★ EXCLUSIVE ★ ★ ★
          </text>
        </g>
      );
    case 'fso':
      return (
        <g>
          <defs>
            <linearGradient id={`${uid}-fso`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3a3f4a" />
              <stop offset=".25" stopColor="#0d0f13" />
              <stop offset="1" stopColor="#050608" />
            </linearGradient>
          </defs>
          <rect {...outer} fill={`url(#${uid}-fso)`} stroke="#000" strokeWidth="1" />
          <rect x="-6" y="-6" width="532" height="130" rx="12" fill="none" stroke="#9ca3af" strokeOpacity=".35" strokeWidth=".8" />
          <rect className="strobe-blue" x="20" y="116" width="70" height="6" rx="3" fill="#3b82f6" />
          <rect className="strobe-red" x="430" y="116" width="70" height="6" rx="3" fill="#ef4444" />
          <text x="260" y="123.5" textAnchor="middle" fontFamily={FONT} fontWeight="700" fontSize="8.5" letterSpacing="4" fill="#cbd5e1" fillOpacity=".7">
            СПЕЦТРАНСПОРТ
          </text>
        </g>
      );
    default:
      return (
        <g>
          <defs>
            <linearGradient id={`${uid}-std`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3b3d42" />
              <stop offset=".18" stopColor="#141518" />
              <stop offset="1" stopColor="#060607" />
            </linearGradient>
          </defs>
          <rect {...outer} fill={`url(#${uid}-std)`} stroke="#000" strokeWidth="1" />
        </g>
      );
  }
}

function Flag({ x, y }) {
  const w = 30;
  const h = 5;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#ffffff" />
      <rect x={x} y={y + h} width={w} height={h} fill="#0039a6" />
      <rect x={x} y={y + h * 2} width={w} height={h} fill="#d52b1e" />
      <rect x={x} y={y} width={w} height={h * 3} fill="none" stroke="#111" strokeWidth=".9" />
    </g>
  );
}

/**
 * @param letters  три буквы ГОСТ, например «АМР»
 * @param digits   три цифры, «001»
 * @param region   код региона, «97» или «777»
 * @param tier     тир редкости — включает неоновое свечение для Rare+
 * @param frame    'standard' | 'carbon' | 'gold' | 'fso' | null (без рамки)
 * @param spinning индексы символов, которые сейчас крутятся (0–5 основная часть, 6 — регион)
 */
export default function LicensePlate({
  letters = 'А000АА',
  digits = '000',
  region = '77',
  tier,
  frame = 'standard',
  glow = true,
  spinning = [],
  className = '',
  title,
}) {
  const uid = `lp${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const chars = [letters[0], digits[0], digits[1], digits[2], letters[1], letters[2]];
  const tierInfo = tier ? TIER_BY_ID[tier] : null;
  const glowing = glow && tierInfo && tierInfo.rank >= 2;
  const spinSet = new Set(spinning);
  const regionLen = String(region).length;

  return (
    <div
      className={`plate-wrap relative w-full select-none ${glowing ? `plate-glow-${tier}` : ''} ${className}`}
      style={{
        aspectRatio: frame ? '540 / 138' : '520 / 112',
        borderRadius: frame ? '2.6% / 10%' : '1.9% / 9%',
        boxShadow: glowing ? tierInfo.glow : '0 6px 18px rgba(0,0,0,.45)',
      }}
      title={title}
    >
      <svg
        viewBox={frame ? FRAMED_VIEWBOX : PLAIN_VIEWBOX}
        className="block h-full w-full"
        role="img"
        aria-label={`Номер ${letters[0]} ${digits} ${letters.slice(1)} регион ${region}`}
      >
        <defs>
          <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset=".55" stopColor="#f3f4f6" />
            <stop offset="1" stopColor="#dfe3e8" />
          </linearGradient>
          <linearGradient id={`${uid}-shine`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".32" stopColor="#fff" stopOpacity=".75" />
            <stop offset=".4" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`${uid}-hole`} cx=".45" cy=".4" r=".6">
            <stop offset="0" stopColor="#1f2937" />
            <stop offset=".7" stopColor="#4b5563" />
            <stop offset="1" stopColor="#9ca3af" />
          </radialGradient>
          <filter id={`${uid}-blur`} x="-20%" y="-30%" width="140%" height="160%">
            <feGaussianBlur stdDeviation="0 3.2" />
          </filter>
        </defs>

        {frame && <Frame frame={frame} uid={uid} />}

        {/* Металлическая основа */}
        <rect x="0.6" y="0.6" width="518.8" height="110.8" rx="10" fill={`url(#${uid}-metal)`} stroke="#9ca3af" strokeWidth="1.2" />
        {/* Чёрная внутренняя рамка и разделитель региона */}
        <rect x="5" y="5" width="510" height="102" rx="7" fill="none" stroke="#111" strokeWidth="3.2" />
        <line x1={SEPARATOR_X} y1="5" x2={SEPARATOR_X} y2="107" stroke="#111" strokeWidth="3.2" />

        {/* Отверстия под болты */}
        {[18.5, 379.5].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="56" r="4.2" fill={`url(#${uid}-hole)`} />
            <circle cx={cx} cy="56" r="4.2" fill="none" stroke="#6b7280" strokeWidth=".6" />
          </g>
        ))}

        {/* Основная часть: Б 000 ББ */}
        {MAIN.map((pos, i) => {
          const isDigit = pos.kind === 'digit';
          return (
            <text
              key={i}
              x={pos.x}
              y={BASELINE}
              textAnchor="middle"
              fontFamily={FONT}
              fontWeight="600"
              fontSize={isDigit ? 82 : 59}
              textLength={isDigit ? 50 : 44}
              lengthAdjust="spacingAndGlyphs"
              fill="#0b0b0c"
              filter={spinSet.has(i) ? `url(#${uid}-blur)` : undefined}
              opacity={spinSet.has(i) ? 0.85 : 1}
            >
              {chars[i]}
            </text>
          );
        })}

        {/* Блок региона */}
        <text
          x={REGION_CX}
          y="66"
          textAnchor="middle"
          fontFamily={FONT}
          fontWeight="600"
          fontSize="64"
          textLength={regionLen === 3 ? 104 : 78}
          lengthAdjust="spacingAndGlyphs"
          fill="#0b0b0c"
          filter={spinSet.has(6) ? `url(#${uid}-blur)` : undefined}
          opacity={spinSet.has(6) ? 0.85 : 1}
        >
          {region}
        </text>
        <text x="416" y="97.5" fontFamily={FONT} fontWeight="700" fontSize="19" textLength="40" lengthAdjust="spacingAndGlyphs" fill="#0b0b0c">
          RUS
        </text>
        <Flag x={462} y={84.5} />

        {/* Блик */}
        <rect x="0.6" y="0.6" width="518.8" height="110.8" rx="10" fill={`url(#${uid}-shine)`} opacity=".55" pointerEvents="none" />
      </svg>
    </div>
  );
}
