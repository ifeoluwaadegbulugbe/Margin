'use client';
import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Award, Brain, CalendarCheck, Crown, Eraser, Flame, Lightbulb, Rocket, Sparkles } from 'lucide-react';
import { useProfile } from '@/stores/profile';
import { levelProgress } from '@/lib/game/levels';
import { displayStreak, localDate } from '@/lib/game/streak';
import type { AchievementDef } from '@/lib/game/achievements';
import { Button, cx } from '@/components/ui';
import { useCountUp } from '@/hooks/useCountUp';
import { Scribble } from '@/components/notebook/Scribble';
import { Sparkle } from '@/components/notebook/Annotations';

/** XP spark symbol: a small four-point star. */
export function Spark({ className }: { className?: string }) {
  return <Sparkle className={cx('inline-block h-[0.9em] w-[0.9em]', className)} color="var(--sunshine)" />;
}

export function XpPill({ compact }: { compact?: boolean }) {
  const user = useProfile((s) => s.user);
  if (!user) return null;
  const lp = levelProgress(user.xp);
  const streak = displayStreak(user.streak, localDate());
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-white px-2.5 py-1 text-sm font-semibold" title={`${lp.toNext} XP to level ${lp.level + 1}`}>
        <span className="text-muted">Level</span><span className="tabular">{String(lp.level).padStart(2, '0')}</span>
        {!compact && <span className="hidden items-center gap-1.5 sm:inline-flex"><span className="text-line">|</span><Spark /><span className="tabular">{user.xp}</span></span>}
      </span>
      <span className="inline-flex items-center gap-1 rounded-[10px] border border-line bg-white px-2.5 py-1 text-sm font-semibold" title="Learning streak">
        <Flame className={cx('h-4 w-4', streak.count ? 'text-coral' : 'text-muted')} aria-hidden /><span className="tabular">{streak.count}</span><span className="sr-only">day streak</span>{!compact && <span className="hidden text-muted sm:inline">{streak.count === 1 ? 'day' : 'days'}</span>}
      </span>
    </div>
  );
}

/** Ink stamp with the level number. */
export function LevelStamp({ level, size = 56, className }: { level: number; size?: number; className?: string }) {
  return (
    <span className={cx('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 60 60" width={size} height={size} aria-hidden>
        <circle cx="30" cy="30" r="27" fill="var(--lavender)" stroke="var(--violet)" strokeWidth="2.5" strokeDasharray="3 2.2" />
        <circle cx="30" cy="30" r="21" fill="none" stroke="var(--violet)" strokeWidth="1.2" />
      </svg>
      <span className="absolute font-display font-extrabold tabular text-violet-ink" style={{ fontSize: size * 0.34 }}>{String(level).padStart(2, '0')}</span>
    </span>
  );
}

const STICKERS: Record<string, { icon: typeof Award; bg: string; fg: string; shape: string }> = {
  'first-light': { icon: Sparkles, bg: 'var(--pale-sun)', fg: 'var(--sun-ink)', shape: '50%' },
  'independent-thinker': { icon: Brain, bg: 'var(--lavender)', fg: 'var(--violet-ink)', shape: '38% 62% 55% 45% / 48% 40% 60% 52%' },
  'hint-free': { icon: Lightbulb, bg: 'var(--pale-mint)', fg: 'var(--mint-ink)', shape: '22%' },
  'self-corrector': { icon: Eraser, bg: 'var(--pale-coral)', fg: 'var(--coral-ink)', shape: '50%' },
  comeback: { icon: Rocket, bg: 'var(--pale-blue)', fg: 'var(--sky-ink)', shape: '60% 40% 45% 55% / 50% 55% 45% 50%' },
  consistency: { icon: CalendarCheck, bg: 'var(--pale-mint)', fg: 'var(--mint-ink)', shape: '24%' },
  'seven-day': { icon: Flame, bg: 'var(--pale-coral)', fg: 'var(--coral-ink)', shape: '50%' },
  'concept-master': { icon: Crown, bg: 'var(--pale-sun)', fg: 'var(--sun-ink)', shape: '30%' },
};

/** Collectible sticker: white die-cut border, own colour and shape; locked = faded outline. */
export function AchievementSticker({ def, unlocked, size = 72, tilt = 0, showName = true }: { def: AchievementDef; unlocked: boolean; size?: number; tilt?: number; showName?: boolean }) {
  const s = STICKERS[def.id] ?? { icon: Award, bg: 'var(--lavender)', fg: 'var(--violet-ink)', shape: '50%' };
  const Icon = s.icon;
  return (
    <div className="flex flex-col items-center gap-2 text-center" title={def.meaning}>
      <span
        className={cx('flex items-center justify-center border-[4px]', unlocked ? 'border-white shadow-[0_4px_12px_rgba(40,36,59,0.14)]' : 'border-dashed border-line')}
        style={{ width: size, height: size, borderRadius: s.shape, background: unlocked ? s.bg : 'var(--warm)', transform: `rotate(${unlocked ? tilt : 0}deg)` }}
      >
        <Icon className="h-[46%] w-[46%]" style={{ color: unlocked ? s.fg : 'var(--line)' }} aria-hidden />
      </span>
      {showName && <span className={cx('text-xs font-semibold leading-4', unlocked ? 'text-ink' : 'text-muted')}>{def.name}</span>}
      <span className="sr-only">{unlocked ? 'Unlocked' : 'Locked'}: {def.meaning}</span>
    </div>
  );
}

/** Ink-style mastery stamp. */
export function MasteryStamp({ label = 'Mastered', size = 88, animate = false }: { label?: string; size?: number; animate?: boolean }) {
  const reduce = useReducedMotion();
  const anim = animate && !reduce ? { initial: { scale: 1.6, opacity: 0, rotate: -24 }, animate: { scale: 1, opacity: 1, rotate: -12 }, transition: { type: 'spring' as const, stiffness: 320, damping: 16 } } : { initial: false as const, style: { rotate: -12 } };
  return (
    <motion.span {...anim} className="inline-flex items-center justify-center rounded-full border-[3px] border-double border-mint-ink font-display font-extrabold uppercase tracking-[0.08em] text-mint-ink" style={{ width: size, height: size, fontSize: size * 0.15, rotate: -12 }}>
      {label}
    </motion.span>
  );
}

let confettiFn: ((o: object) => void) | null = null;
/** Particles only for big moments: independent solve, level up, all topics mastered. */
export async function burst(particles = 40) {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!confettiFn) confettiFn = (await import('canvas-confetti')).default as unknown as (o: object) => void;
  confettiFn({ particleCount: particles, spread: 75, origin: { y: 0.55 }, shapes: ['star', 'circle'], scalar: 0.9, colors: ['#7657E8', '#FF786C', '#FFBD59', '#62CBAA', '#72BFEA'], disableForReducedMotion: true });
}

export function LevelUpOverlay({ level, rank, xp, onClose }: { level: number; rank: string; xp: number; onClose: () => void }) {
  const reduce = useReducedMotion();
  const lp = levelProgress(xp);
  useEffect(() => { void burst(60); }, []);
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="dialog" aria-modal aria-label="Level up">
      <motion.div className="paper-ruled w-full max-w-sm rounded-[24px] border border-line p-7 text-center shadow-[var(--shadow-floating)]"
        initial={reduce ? { opacity: 0 } : { y: 40, opacity: 0, rotate: -3 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 18 }}>
        <div className="flex justify-center"><Scribble mood="celebrating" size={72} /></div>
        <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Your learning level</div>
        <div className="mt-1 font-display text-lg font-bold text-violet-ink">Level {String(level).padStart(2, '0')}</div>
        <h2 className="font-display text-[34px] font-extrabold leading-10">{rank} <Spark /></h2>
        <p className="mt-3 text-ink-2"><span className="tabular font-semibold text-ink">{xp} XP</span> · {lp.toNext} XP until your next level.</p>
        <Button onClick={onClose} autoFocus className="mt-6">Keep going</Button>
      </motion.div>
    </motion.div>
  );
}

export function AchievementReveal({ queue, onDone }: { queue: AchievementDef[]; onDone: () => void }) {
  const reduce = useReducedMotion();
  const shown = queue.slice(0, 3);
  const extra = queue.length - shown.length;
  return (
    <AnimatePresence>
      {shown.length > 0 && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal aria-label="New sticker unlocked">
          <div className="w-full max-w-md rounded-[24px] border border-line bg-paper p-7 text-center shadow-[var(--shadow-floating)]">
            <div className="font-hand text-[28px] text-coral-ink">New sticker{shown.length > 1 ? 's' : ''} for your notebook!</div>
            <div className="mt-6 flex flex-wrap justify-center gap-6">
              {shown.map((a, i) => (
                <motion.div key={a.id}
                  initial={reduce ? { opacity: 0 } : { y: 60, scale: 0.4, opacity: 0, rotate: -20 }}
                  animate={{ y: 0, scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ delay: 0.15 + i * 0.25, type: 'spring', stiffness: 260, damping: 14 }}
                  className="flex max-w-[160px] flex-col items-center gap-2">
                  <AchievementSticker def={a} unlocked size={88} tilt={i % 2 ? 6 : -6} />
                  <p className="text-sm text-ink-2">{a.meaning}</p>
                  <span className="inline-flex items-center gap-1 font-display font-bold tabular text-sun-ink">+{a.reward} XP</span>
                </motion.div>
              ))}
            </div>
            {extra > 0 && <p className="mt-3 text-sm text-muted">…and {extra} more in Rewards.</p>}
            <Button onClick={onDone} autoFocus className="mt-6">Add to my collection</Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function CountUp({ value, className }: { value: number; className?: string }) {
  const v = useCountUp(value, 800);
  return <span className={cx('tabular', className)}>{v}</span>;
}
