import { CircleAlert, CircleCheck, Crown, Gem, Info, Sparkles, TriangleAlert, Trophy, X } from 'lucide-react';

const KINDS = {
  success: { icon: CircleCheck, cls: 'border-emerald-400/40 bg-emerald-950/90 text-emerald-100', iconCls: 'text-emerald-400' },
  error: { icon: CircleAlert, cls: 'border-rose-400/40 bg-rose-950/90 text-rose-100', iconCls: 'text-rose-400' },
  warning: { icon: TriangleAlert, cls: 'border-amber-400/40 bg-amber-950/90 text-amber-100', iconCls: 'text-amber-400' },
  info: { icon: Info, cls: 'border-sky-400/30 bg-zinc-900/95 text-zinc-100', iconCls: 'text-sky-400' },
  achievement: { icon: Trophy, cls: 'border-amber-300/60 bg-zinc-900/95 text-amber-100', iconCls: 'text-amber-300' },
  rare: { icon: Gem, cls: 'border-sky-400/60 bg-sky-950/90 text-sky-100', iconCls: 'text-sky-300' },
  epic: { icon: Sparkles, cls: 'border-fuchsia-400/60 bg-fuchsia-950/90 text-fuchsia-100', iconCls: 'text-fuchsia-300' },
  legendary: { icon: Crown, cls: 'border-amber-300/80 bg-gradient-to-r from-amber-950/95 to-red-950/95 text-amber-50', iconCls: 'text-amber-300' },
};

export default function Toasts({ toasts, onDismiss }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col-reverse items-center gap-2 px-4 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-[7.5rem] sm:flex-col sm:items-end">
      {toasts.map((t) => {
        const k = KINDS[t.kind] ?? KINDS.info;
        const IconCmp = k.icon;
        return (
          <div
            key={t.id}
            className={`animate-slide-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-3 shadow-2xl backdrop-blur ${k.cls}`}
            role="status"
          >
            <IconCmp className={`mt-0.5 h-5 w-5 shrink-0 ${k.iconCls}`} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{t.title}</div>
              {t.text && <div className="text-xs opacity-80">{t.text}</div>}
            </div>
            <button type="button" onClick={() => onDismiss(t.id)} className="opacity-50 transition hover:opacity-100" aria-label="Закрыть">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
