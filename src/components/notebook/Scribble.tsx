'use client';
import { cx } from '@/components/ui';

export type Mood = 'curious' | 'thinking' | 'encouraging' | 'excited' | 'celebrating';

/**
 * Scribble: a small paper-blob companion with a pencil-curl on top.
 * It appears at contextual moments rather than occupying the interface.
 */
export function Scribble({ mood = 'curious', size = 56, className, title }: { mood?: Mood; size?: number; className?: string; title?: string }) {
  const eyesUp = mood === 'thinking';
  const happy = mood === 'excited' || mood === 'celebrating';
  return (
    <svg viewBox="0 0 72 72" width={size} height={size} className={cx('shrink-0 overflow-visible', mood !== 'thinking' && 'bob', className)} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {mood === 'celebrating' && (
        <g>
          <path d="M8 10 l2 5 l5 1 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -1z" fill="var(--sunshine)" />
          <path d="M62 6 l1.5 4 l4 1 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1z" fill="var(--violet)" />
          <circle cx="66" cy="30" r="2" fill="var(--coral)" />
        </g>
      )}
      {/* arms */}
      {mood === 'celebrating' ? (
        <g stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" fill="none">
          <path d="M14 36 q-8 -6 -7 -16" /><path d="M58 36 q8 -6 7 -16" />
        </g>
      ) : mood === 'encouraging' ? (
        <g stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" fill="none">
          <path d="M13 44 q-6 2 -7 7" /><path d="M59 40 q7 -3 8 -10" />
        </g>
      ) : (
        <g stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" fill="none">
          <path d="M13 44 q-6 2 -7 7" /><path d="M59 44 q6 2 7 7" />
        </g>
      )}
      {/* body: soft, slightly irregular paper blob */}
      <path d="M36 12 C52 11 62 22 61 39 C60 55 49 63 35 62 C20 61 10 52 11 37 C12 22 21 13 36 12 Z" fill="var(--white)" stroke="var(--ink)" strokeWidth="2.4" />
      <path d="M36 12 C52 11 62 22 61 39 C60 55 49 63 35 62" fill="none" stroke="var(--lavender)" strokeWidth="5" opacity="0.7" transform="translate(-2 2)" />
      {/* pencil curl */}
      <path d="M28 13 c1 -8 7 -9 8 -3 c1 6 7 5 8 -2" fill="none" stroke="var(--violet)" strokeWidth="2.6" strokeLinecap="round" />
      {/* cheeks */}
      <ellipse cx="22" cy="44" rx="4" ry="2.5" fill="var(--coral)" opacity="0.45" />
      <ellipse cx="50" cy="44" rx="4" ry="2.5" fill="var(--coral)" opacity="0.45" />
      {/* eyes */}
      {happy ? (
        <g stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" fill="none"><path d="M24 36 q3 -4 6 0" /><path d="M42 36 q3 -4 6 0" /></g>
      ) : (
        <g fill="var(--ink)">
          <circle cx={eyesUp ? 29 : 27} cy={eyesUp ? 33 : 36} r="3" />
          <circle cx={eyesUp ? 46 : 45} cy={eyesUp ? 33 : 36} r="3" />
          <circle cx={eyesUp ? 30 : 28} cy={eyesUp ? 32 : 35} r="1" fill="#fff" />
          <circle cx={eyesUp ? 47 : 46} cy={eyesUp ? 32 : 35} r="1" fill="#fff" />
        </g>
      )}
      {mood === 'curious' && <path d="M41 29 q4 -3 8 -1" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" fill="none" />}
      {/* mouth */}
      {mood === 'curious' && <circle cx="36" cy="47" r="2.6" fill="none" stroke="var(--ink)" strokeWidth="2.2" />}
      {mood === 'thinking' && <path d="M32 48 q4 -2 8 0" fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />}
      {mood === 'encouraging' && <path d="M29 45 q7 7 14 0" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />}
      {happy && <path d="M28 44 q8 11 16 0 z" fill="var(--ink)" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" />}
      {/* thinking pencil */}
      {mood === 'thinking' && (
        <g className="pencil-wiggle">
          <g transform="translate(58 46) rotate(-40)">
            <rect x="0" y="0" width="16" height="5" rx="1" fill="var(--sunshine)" stroke="var(--ink)" strokeWidth="1.4" />
            <path d="M16 0 L21 2.5 L16 5 Z" fill="#f6d8b0" stroke="var(--ink)" strokeWidth="1.4" strokeLinejoin="round" />
            <rect x="-3" y="0" width="3" height="5" fill="var(--coral)" stroke="var(--ink)" strokeWidth="1.4" />
          </g>
        </g>
      )}
    </svg>
  );
}

export function MarginMark({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--violet)" />
      <path d="M8 1 V31" stroke="var(--coral)" strokeWidth="2" opacity="0.9" />
      <path d="M12.5 22 V14.5 c0 -2 3.5 -2 3.5 0 V22 M16 14.5 c0 -2 3.5 -2 3.5 0 V22" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M22 9 l1 2 l2 .5 l-2 .8 l-1 2 l-.8 -2 l-2 -.8 l2 -.5z" fill="var(--sunshine)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <MarginMark />
      <span className="font-display text-[22px] font-extrabold tracking-tight text-ink">margin</span>
    </span>
  );
}
