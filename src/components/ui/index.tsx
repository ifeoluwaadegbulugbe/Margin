'use client';
import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { Loader2, X } from 'lucide-react';
import { useToast } from '@/stores/toast';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'sun';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  size?: 'md' | 'sm' | 'lg';
  icon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-violet text-white shadow-[0_3px_0_var(--violet-ink)] hover:-translate-y-px hover:shadow-[0_4px_0_var(--violet-ink)] active:translate-y-px active:shadow-[0_1px_0_var(--violet-ink)]',
  secondary: 'bg-white text-ink border border-line shadow-[var(--shadow-card)] hover:border-violet/50 hover:-translate-y-px',
  ghost: 'text-violet-ink hover:bg-lavender/60',
  danger: 'bg-white text-coral-ink border border-coral/40 hover:bg-pale-coral',
  sun: 'bg-sunshine text-ink shadow-[0_3px_0_#d9952f] hover:-translate-y-px',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading, size = 'md', icon, className, children, disabled, ...rest }, ref,
) {
  const sizes = { sm: 'h-9 px-3.5 text-sm', md: 'h-11 px-5 text-[15px]', lg: 'h-13 px-7 text-base' };
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-[14px] font-semibold transition-all duration-150 disabled:opacity-45 disabled:pointer-events-none select-none',
        sizes[size], VARIANTS[variant], className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button aria-label={label} title={label} className={cx('inline-flex h-10 w-10 items-center justify-center rounded-[12px] text-muted hover:bg-warm hover:text-ink transition-colors', className)} {...rest}>
      {children}
    </button>
  );
}

/** Notebook card: clean white paper surface. */
export function Card({ className, interactive, ...rest }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cx(
        'rounded-[18px] border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:p-6',
        interactive && 'cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-floating)] hover:border-violet/40',
        className,
      )}
      {...rest}
    />
  );
}

/** Coloured paper note card (hints, explanations, reminders). */
export function NoteCard({ tone = 'sun', tilt = 0, className, children, ...rest }: HTMLAttributes<HTMLDivElement> & { tone?: 'sun' | 'lavender' | 'mint' | 'blue' | 'coral' | 'white'; tilt?: number }) {
  const tones = {
    sun: 'bg-pale-sun border-sunshine/50',
    lavender: 'bg-lavender border-violet/25',
    mint: 'bg-pale-mint border-mint/40',
    blue: 'bg-pale-blue border-sky/40',
    coral: 'bg-pale-coral border-coral/40',
    white: 'bg-white border-line',
  };
  return (
    <div className={cx('relative rounded-[14px] border p-4 shadow-[var(--shadow-card)]', tones[tone], className)} style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined} {...rest}>
      {children}
    </div>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('text-[11px] font-semibold uppercase tracking-[0.08em] text-muted', className)}>{children}</div>;
}

export function Hand({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('font-hand text-[22px] leading-6', className)}>{children}</span>;
}

type Tone = 'neutral' | 'violet' | 'sun' | 'mint' | 'sky' | 'coral';
export function Chip({ children, tone = 'neutral', className, title }: { children: ReactNode; tone?: Tone; className?: string; title?: string }) {
  const tones: Record<Tone, string> = {
    neutral: 'bg-warm text-ink-2 border-line',
    violet: 'bg-lavender text-violet-ink border-violet/20',
    sun: 'bg-pale-sun text-sun-ink border-sunshine/50',
    mint: 'bg-pale-mint text-mint-ink border-mint/40',
    sky: 'bg-pale-blue text-sky-ink border-sky/40',
    coral: 'bg-pale-coral text-coral-ink border-coral/40',
  };
  return <span title={title} className={cx('inline-flex items-center gap-1.5 rounded-[8px] border px-2 py-0.5 text-xs font-semibold', tones[tone], className)}>{children}</span>;
}

export function ProgressBar({ value, label, right, className, color = 'violet' }: { value: number; label?: ReactNode; right?: ReactNode; className?: string; color?: 'violet' | 'mint' | 'sun' }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const fill = { violet: 'bg-violet', mint: 'bg-mint', sun: 'bg-sunshine' }[color];
  return (
    <div className={className}>
      {(label || right) && (
        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm text-ink-2">
          <span>{label}</span>
          <span className="tabular">{right}</span>
        </div>
      )}
      <div className="h-2.5 overflow-hidden rounded-full bg-warm" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cx('h-full rounded-full transition-[width] duration-[600ms] ease-[var(--ease)]', fill)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Ring({ value, size = 56, stroke = 6, color = 'var(--violet)', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--warm)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} style={{ transition: 'stroke-dashoffset 600ms var(--ease)' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('shimmer rounded-[14px]', className)} aria-hidden />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('h-5 w-5 animate-spin text-muted', className)} aria-label="Loading" />;
}

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="fixed inset-x-4 top-4 z-50 flex flex-col items-stretch gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-auto sm:w-96" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={cx('flex items-start gap-3 rounded-[14px] border bg-white px-4 py-3 text-sm shadow-[var(--shadow-floating)]',
          t.kind === 'error' ? 'border-coral/50' : t.kind === 'success' ? 'border-mint/50' : 'border-line')}>
          <span className="flex-1 text-ink">{t.text}</span>
          {t.action && <button className="font-semibold text-violet-ink" onClick={t.action.run}>{t.action.label}</button>}
          <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/35 sm:items-center" role="dialog" aria-modal aria-label={title} onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-[540px] overflow-y-auto rounded-t-[24px] border border-line bg-paper p-6 shadow-[var(--shadow-floating)] sm:rounded-[24px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-[24px] font-bold leading-8">{title}</h2>
          <IconButton label="Close" onClick={onClose}><X className="h-5 w-5" /></IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, cta, art }: { title: string; cta?: ReactNode; art?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      {art}
      <p className="max-w-sm text-ink-2">{title}</p>
      {cta}
    </div>
  );
}
