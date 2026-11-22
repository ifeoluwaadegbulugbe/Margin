'use client';
import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties } from 'react';

/** Hand-drawn annotation library. Strokes draw themselves in (pathLength) unless motion is reduced. */
type Common = { className?: string; color?: string; style?: CSSProperties; delay?: number; width?: number };

function useDraw(delay = 0, duration = 0.45) {
  const reduce = useReducedMotion();
  return reduce
    ? { initial: { pathLength: 1, opacity: 1 }, animate: { pathLength: 1, opacity: 1 } }
    : { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: { delay, duration, ease: [0.2, 0.8, 0.2, 1] as const } };
}

export function Underline({ className, color = 'var(--coral)', style, delay, width = 3 }: Common) {
  const d = useDraw(delay);
  return (
    <svg viewBox="0 0 200 14" preserveAspectRatio="none" className={className} style={style} aria-hidden>
      <motion.path d="M3 9 C 30 3, 55 12, 85 7 S 140 3, 168 8 S 190 10, 197 6" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" {...d} />
    </svg>
  );
}

export function CircleMark({ className, color = 'var(--coral)', style, delay, width = 2.5 }: Common) {
  const d = useDraw(delay, 0.6);
  return (
    <svg viewBox="0 0 200 80" preserveAspectRatio="none" className={className} style={style} aria-hidden>
      <motion.path d="M30 14 C 70 2, 160 4, 188 26 C 205 44, 170 72, 100 75 C 40 78, 4 62, 8 40 C 11 22, 40 10, 92 7" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" {...d} />
    </svg>
  );
}

export function Arrow({ className, color = 'var(--coral)', style, delay, width = 2.5, flip }: Common & { flip?: boolean }) {
  const d = useDraw(delay);
  const dh = useDraw((delay ?? 0) + 0.35, 0.2);
  return (
    <svg viewBox="0 0 90 60" className={className} style={{ ...style, transform: flip ? 'scaleX(-1)' : undefined }} aria-hidden>
      <motion.path d="M6 8 C 30 4, 64 14, 72 46" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" {...d} />
      <motion.path d="M60 38 L 73 50 L 80 34" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" {...dh} />
    </svg>
  );
}

export function StarDoodle({ className, color = 'var(--sunshine)', style, filled = true }: Common & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden>
      <path d="M12 2.5 L14.3 8.6 L20.9 9 L15.8 13.1 L17.5 19.5 L12 15.9 L6.5 19.5 L8.2 13.1 L3.1 9 L9.7 8.6 Z" fill={filled ? color : 'none'} stroke="var(--ink)" strokeWidth={1.2} strokeLinejoin="round" />
    </svg>
  );
}

export function Sparkle({ className, color = 'var(--sunshine)', style }: Common) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden>
      <path d="M12 1 C13 8 16 11 23 12 C16 13 13 16 12 23 C11 16 8 13 1 12 C8 11 11 8 12 1 Z" fill={color} />
    </svg>
  );
}

export function CheckDoodle({ className, color = 'var(--mint-ink)', style, delay, width = 3 }: Common) {
  const d = useDraw(delay, 0.25);
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden>
      <motion.path d="M4 13 C 6 15, 8 17, 9.5 19 C 12 13, 16 8, 21 4" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" {...d} />
    </svg>
  );
}

export function CrossDoodle({ className, color = 'var(--coral-ink)', style, width = 2.6 }: Common) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden>
      <path d="M6 6 C 10 10, 14 14, 18 18 M18 6 C 14 10, 10 14, 6 18" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
    </svg>
  );
}

export function Squiggle({ className, color = 'var(--violet)', style, width = 2.5 }: Common) {
  return (
    <svg viewBox="0 0 60 16" className={className} style={style} aria-hidden>
      <path d="M2 10 c5 -9 9 -9 12 0 s7 9 12 0 s7 -9 12 0 s7 9 12 0" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
    </svg>
  );
}

/** Washi tape strip for pinning note cards. */
export function Tape({ className, color = 'rgba(255,189,89,0.55)', style }: Common) {
  return (
    <span aria-hidden className={className} style={{ display: 'block', width: 64, height: 18, background: color, borderRadius: 2, maskImage: 'linear-gradient(90deg, transparent 0, #000 6%, #000 94%, transparent 100%)', ...style }} />
  );
}

export function CornerFold({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M0 0 H24 L0 24 Z" fill="var(--warm)" />
      <path d="M24 0 L0 24" stroke="var(--line)" />
    </svg>
  );
}

/** A small burst of stars for discovery moments (pure SVG/CSS, no canvas). */
export function StarBurst({ show }: { show: boolean }) {
  const reduce = useReducedMotion();
  if (!show || reduce) return null;
  const dirs = [[-40, -30], [42, -26], [-30, 34], [36, 30], [0, -46], [-50, 4], [52, 6]];
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden>
      {dirs.map(([x, y], i) => (
        <motion.span key={i} className="absolute" initial={{ x: 0, y: 0, scale: 0.2, opacity: 1 }} animate={{ x, y, scale: 1, opacity: 0 }} transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.02 }}>
          <Sparkle className="h-3.5 w-3.5" color={i % 2 ? 'var(--violet)' : 'var(--sunshine)'} />
        </motion.span>
      ))}
    </span>
  );
}
