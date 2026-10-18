import { useMemo, useState } from 'react';
import { BookOpen, Calculator, MapPin, Search, Siren, Sigma } from 'lucide-react';
import LicensePlate from './LicensePlate.jsx';
import RegionSelect from './RegionSelect.jsx';
import { Card, RarityBadge, SectionTitle, TagChip } from './ui.jsx';
import {
  BASE_PRICE, LETTERS, MULTIPLIERS as M, NICE_SERIES, REGIONS, SPECIAL_SERIES, TIERS, TIER_BY_ID, TRIPLE_LETTERS_TOP,
} from '../data/platesConfig.js';
import { evaluatePlate, normalizeLetters } from '../utils/plateEvaluator.js';
import { money } from '../utils/format.js';

const COMBO_GROUPS = [
  {
    title: 'Буквы',
    rows: [
      ['Блатные серии (АМР, ЕКХ, СКР, ВМР, ХКХ, ВОР, ХАМ, ХЕР, КОТ)', `×${M.niceSeriesRange[0]}–×${M.niceSeriesRange[1]}`, 'в любом регионе'],
      [`Три одинаковые: ${Object.keys(TRIPLE_LETTERS_TOP).map((l) => l.repeat(3)).join(', ')}`, `×${M.tripleLettersTop}`, '«Анны», «Ольги», «Иксы»…'],
      ['Остальные три одинаковые (ЕЕЕ, ККК, ННН, РРР, ССС, ТТТ, УУУ)', `×${M.tripleLettersOther}`, ''],
      ['Зеркальные буквы (А…ОА: первая = третья)', `×${M.mirrorLetters}`, ''],
    ],
  },
  {
    title: 'Цифры',
    rows: [
      ['Топоры и компания: 777, 888, 999, 111', `×${M.tripleDigitsTop}`, ''],
      ['Остальные тройные: 222–666', `×${M.tripleDigitsOther}`, ''],
      ['001 — «Номер Первый»', `×${M.first001}`, ''],
      ['007 — «Агент 007»', `×${M.first007}`, ''],
      ['Первая десятка 002–009', `×${M.firstOther}`, ''],
      ['Ровные сотни 100, 200 … 900', `×${M.roundHundred}`, ''],
      ['Лесенка 123, 456, 987…', `×${M.ladder}`, ''],
      ['Зеркальные 101, 707, 050, 818…', `×${M.mirrorDigits}`, ''],
      ['Бинго: цифры = код региона (077 на 77, 777 на 777)', `×${M.bingo}`, 'складывается с остальными'],
    ],
  },
  {
    title: 'Бонусы',
    rows: [
      ['Блатной комплект: буквы ×10+ и цифры ×10+ на одном номере', `×${M.combo}`, ''],
      ['Престижный регион (777 — ×2, 77 — ×1,6, 95 — ×1,6 …)', '×1–×2', 'см. таблицу регионов'],
    ],
  },
];

function Evaluator() {
  const [letters, setLetters] = useState('ЕКХ');
  const [digits, setDigits] = useState('001');
  const [region, setRegion] = useState('77');

  const valid = letters.length === 3 && /^\d{3}$/.test(digits) && digits !== '000';
  const result = useMemo(() => (valid ? evaluatePlate({ letters, digits, region }) : null), [valid, letters, digits, region]);

  const input = 'h-11 rounded-xl border border-white/10 bg-zinc-800 px-3 text-center text-zinc-100 font-display text-xl uppercase tracking-[.3em] outline-none focus:border-sky-400';

  return (
    <Card className="p-4">
      <SectionTitle icon={Calculator}>Оценить свой номер</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.4fr]">
        <label className="text-xs uppercase tracking-wider text-zinc-500">
          Буквы
          <input
            className={`${input} mt-1 w-full`}
            value={letters}
            maxLength={3}
            onChange={(e) => setLetters(normalizeLetters(e.target.value).slice(0, 3))}
            placeholder="АМР"
          />
        </label>
        <label className="text-xs uppercase tracking-wider text-zinc-500">
          Цифры
          <input
            className={`${input} mt-1 w-full`}
            value={digits}
            inputMode="numeric"
            maxLength={3}
            onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 3))}
            placeholder="001"
          />
        </label>
        <label className="text-xs uppercase tracking-wider text-zinc-500">
          Регион
          <RegionSelect value={region} onChange={setRegion} className="mt-1 h-11" />
        </label>
      </div>
      <p className="mt-2 text-[11px] text-zinc-600">Допустимые буквы: {LETTERS.join(' ')} · можно вводить латиницей</p>

      <div className="mt-4">
        {valid ? (
          <div className="space-y-3">
            <div className="mx-auto max-w-xl">
              <LicensePlate letters={letters} digits={digits} region={region} tier={result.tier} />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <RarityBadge tier={result.tier} />
              <span className={`font-display text-2xl font-bold ${result.tier === 'legendary' ? 'text-shimmer' : TIER_BY_ID[result.tier].text}`}>
                {money(result.value)}
              </span>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {result.tags.length ? result.tags.map((t) => <TagChip key={t.id} tag={t} />) : <span className="text-sm text-zinc-500">Без комбинаций</span>}
            </div>
            <p className="text-center text-xs text-zinc-500">
              {money(result.basePrice)} × {result.regionCoef} (регион) × {result.letterMult} (буквы) × {Number(result.digitMult.toFixed(2))} (цифры)
              {result.combo && ' × 2 (комплект)'}
            </p>
          </div>
        ) : (
          <p className="text-center text-sm text-zinc-500">Введите 3 буквы ГОСТ и 3 цифры (кроме 000)</p>
        )}
      </div>
    </Card>
  );
}

export default function PriceGuide() {
  const [regionQuery, setRegionQuery] = useState('');
  const regions = useMemo(() => {
    const q = regionQuery.trim().toLowerCase();
    return REGIONS.filter((r) => !q || r.code.includes(q) || r.name.toLowerCase().includes(q)).sort((a, b) => b.coef - a.coef || Number(a.code) - Number(b.code));
  }, [regionQuery]);

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <SectionTitle icon={Sigma}>Как считается цена</SectionTitle>
        <p className="text-sm text-zinc-300">
          <b>Цена</b> = База ({money(BASE_PRICE.min)}–{money(BASE_PRICE.max)}) × Коэффициент региона × Множитель букв × Множитель цифр × Комплект
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          База зависит от самого номера и всегда одинакова для одной и той же комбинации. Множители перемножаются, поэтому редкие сочетания дают миллионы.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          {TIERS.map((t, i) => (
            <div key={t.id} className={`rounded-xl border p-3 ${t.border} ${t.bg}`}>
              <div className={`font-display font-semibold uppercase ${t.id === 'legendary' ? 'text-shimmer' : t.text}`}>{t.name}</div>
              <div className="text-xs text-zinc-400">{t.short}</div>
              <div className="mt-1 text-sm text-zinc-200">
                {TIERS[i + 1] ? `${money(t.min)} – ${money(TIERS[i + 1].min)}` : `от ${money(t.min)}`}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Evaluator />

      <Card className="p-4">
        <SectionTitle icon={Siren}>Региональные спецсерии</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="py-2 pr-3">Серия</th>
                <th className="py-2 pr-3">Регионы</th>
                <th className="py-2 pr-3">Описание</th>
                <th className="py-2 text-right">Множитель</th>
              </tr>
            </thead>
            <tbody>
              {SPECIAL_SERIES.map((s) => (
                <tr key={s.letters + s.regions.join()} className="border-t border-white/5">
                  <td className="py-2 pr-3 font-display text-base font-semibold tracking-widest text-red-300">{s.letters}</td>
                  <td className="py-2 pr-3 text-zinc-300">{s.regions.join(', ')}</td>
                  <td className="py-2 pr-3 text-zinc-400">{s.label}</td>
                  <td className="py-2 text-right font-semibold text-zinc-100">×{s.mult}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-500">Вне своих регионов АМР, ЕКХ и СКР считаются обычными блатными сериями, а ААА/ООО — тройными буквами.</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {COMBO_GROUPS.map((g) => (
          <Card key={g.title} className="p-4">
            <SectionTitle icon={BookOpen}>{g.title}</SectionTitle>
            <div className="divide-y divide-white/5">
              {g.rows.map(([name, mult, note]) => (
                <div key={name} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <div>
                    <div className="text-zinc-200">{name}</div>
                    {note && <div className="text-xs text-zinc-500">{note}</div>}
                  </div>
                  <span className="whitespace-nowrap font-semibold text-sky-300">{mult}</span>
                </div>
              ))}
            </div>
            {g.title === 'Буквы' && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(NICE_SERIES).map(([l, s]) => (
                  <span key={l} className="rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200" title={s.label}>
                    {l} ×{s.mult}
                  </span>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <SectionTitle
          icon={MapPin}
          right={<span className="text-xs text-zinc-500">{REGIONS.length} кодов</span>}
        >
          Регионы
        </SectionTitle>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={regionQuery}
            onChange={(e) => setRegionQuery(e.target.value)}
            placeholder="Код или название субъекта"
            className="h-10 w-full rounded-xl border border-white/10 bg-zinc-800 pl-9 pr-3 text-sm outline-none focus:border-sky-400"
          />
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <tbody>
              {regions.map((r) => (
                <tr key={r.code} className="border-t border-white/5">
                  <td className="w-16 py-1.5 font-display text-base font-semibold text-zinc-100">{r.code}</td>
                  <td className="py-1.5 text-zinc-400">{r.name}</td>
                  <td className={`py-1.5 text-right font-semibold ${r.coef > 1 ? 'text-emerald-300' : 'text-zinc-500'}`}>×{r.coef}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
