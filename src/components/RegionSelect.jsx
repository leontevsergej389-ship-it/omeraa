import { SUBJECTS } from '../data/platesConfig.js';

/** Выпадающий список регионов, сгруппированный по субъектам РФ. */
export default function RegionSelect({ value, onChange, allowAny = false, anyLabel = 'Любой регион', className = '', disabled }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`h-10 w-full rounded-xl border border-white/10 bg-zinc-800 px-3 text-sm text-zinc-100 outline-none transition focus:border-sky-400 disabled:opacity-50 ${className}`}
    >
      {allowAny && <option value="">{anyLabel}</option>}
      {SUBJECTS.map((s) => (
        <optgroup key={s.name} label={s.name}>
          {s.codes.map((code) => (
            <option key={code} value={code}>
              {code} — {s.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
