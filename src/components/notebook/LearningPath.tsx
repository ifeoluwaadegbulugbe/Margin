'use client';
import { Check, Lock } from 'lucide-react';
import { SKILLS, getSkill } from '@/content';
import { isUnlocked, type MasteryRecord } from '@/lib/game/mastery';
import { cx } from '@/components/ui';

export type TopicState = 'complete' | 'in-progress' | 'ready' | 'revise' | 'locked';

/** Small glyph "illustration" per topic, in the topic's accent. */
export const TOPIC_ART: Record<string, { glyph: string; bg: string; fg: string }> = {
  'neg-numbers': { glyph: '−3', bg: 'var(--pale-blue)', fg: 'var(--sky-ink)' },
  'order-ops': { glyph: '( )', bg: 'var(--pale-sun)', fg: 'var(--sun-ink)' },
  fractions: { glyph: '½', bg: 'var(--pale-mint)', fg: 'var(--mint-ink)' },
  'two-step': { glyph: 'x=', bg: 'var(--lavender)', fg: 'var(--violet-ink)' },
  'multi-step': { glyph: '2(x)', bg: 'var(--pale-coral)', fg: 'var(--coral-ink)' },
};

export function topicState(id: string, mastery: Record<string, MasteryRecord | undefined>, revise: string[] = []): TopicState {
  const s = getSkill(id);
  if (!s) return 'locked';
  const m = mastery[id];
  if (m?.mastered) return revise.includes(id) ? 'revise' : 'complete';
  if (!isUnlocked(s.prerequisites, mastery)) return 'locked';
  if (revise.includes(id)) return 'revise';
  return (m?.attempts ?? 0) > 0 || (m?.value ?? 0) > 0 ? 'in-progress' : 'ready';
}

const STATE_LABEL: Record<TopicState, { text: string; cls: string }> = {
  complete: { text: 'Mastered', cls: 'bg-pale-mint text-mint-ink border-mint/40' },
  'in-progress': { text: 'In progress', cls: 'bg-lavender text-violet-ink border-violet/20' },
  ready: { text: 'Ready', cls: 'bg-pale-sun text-sun-ink border-sunshine/50' },
  revise: { text: 'Revise', cls: 'bg-pale-coral text-coral-ink border-coral/40' },
  locked: { text: 'Locked', cls: 'bg-warm text-muted border-line' },
};

export function StateTag({ state }: { state: TopicState }) {
  const l = STATE_LABEL[state];
  return <span className={cx('inline-flex items-center rounded-[8px] border px-2 py-0.5 text-xs font-semibold', l.cls)}>{l.text}</span>;
}

export function TopicGlyph({ id, size = 48, dim }: { id: string; size?: number; dim?: boolean }) {
  const a = TOPIC_ART[id] ?? { glyph: '?', bg: 'var(--warm)', fg: 'var(--muted)' };
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-[14px] font-hand font-bold" style={{ width: size, height: size, background: dim ? 'var(--warm)' : a.bg, color: dim ? 'var(--muted)' : a.fg, fontSize: size * 0.48 }} aria-hidden>
      {a.glyph}
    </span>
  );
}

/**
 * Connected learning steps: what's complete, what's current, what unlocks next, what needs revision.
 * Wraps from a horizontal path (desktop) to a vertical one (mobile).
 */
export function LearningPath({ mastery, selected, onSelect, recommended, revise = [] }: {
  mastery: Record<string, MasteryRecord | undefined>;
  selected?: string | null;
  onSelect?: (id: string) => void;
  recommended?: string | null;
  revise?: string[];
}) {
  return (
    <ol className="relative grid gap-3 md:grid-cols-5 md:gap-4" aria-label="Learning path">
      {SKILLS.map((s, i) => {
        const st = topicState(s.id, mastery, revise);
        const m = mastery[s.id]?.value ?? 0;
        const isSel = selected === s.id;
        return (
          <li key={s.id} className="relative">
            {i < SKILLS.length - 1 && (
              <span aria-hidden className={cx('absolute hidden md:block left-[calc(50%+34px)] right-[calc(-50%+34px)] top-[34px] border-t-[2.5px] border-dashed', st === 'complete' ? 'border-mint' : 'border-line')} />
            )}
            {i < SKILLS.length - 1 && <span aria-hidden className="absolute left-[33px] top-[68px] h-[calc(100%-56px)] border-l-[2.5px] border-dashed border-line md:hidden" />}
            <button
              type="button"
              onClick={() => onSelect?.(s.id)}
              aria-pressed={isSel}
              className={cx('relative flex w-full items-center gap-3 rounded-[18px] p-1 text-left md:flex-col md:items-center md:gap-2 md:p-2 md:text-center transition-colors',
                onSelect && 'hover:bg-white', isSel && 'bg-white shadow-[var(--shadow-card)]')}
            >
              <span className="relative">
                <span className={cx('flex h-[64px] w-[64px] items-center justify-center rounded-full border-[3px] bg-white',
                  st === 'complete' ? 'border-mint' : st === 'locked' ? 'border-dashed border-line' : st === 'revise' ? 'border-coral' : 'border-violet')}>
                  <TopicGlyph id={s.id} size={44} dim={st === 'locked'} />
                </span>
                {st === 'complete' && <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-mint text-white"><Check className="h-4 w-4" aria-hidden /></span>}
                {st === 'locked' && <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-warm text-muted"><Lock className="h-3.5 w-3.5" aria-hidden /></span>}
                {recommended === s.id && st !== 'complete' && <span className="absolute -left-2 -top-3 rotate-[-10deg] font-hand text-[18px] font-bold text-coral-ink">next!</span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cx('block text-[15px] font-semibold leading-5', st === 'locked' ? 'text-muted' : 'text-ink')}>{s.name}</span>
                <span className="mt-1 flex items-center gap-2 md:justify-center"><StateTag state={st} />{st !== 'locked' && <span className="text-xs tabular text-muted">{Math.round(m * 100)}%</span>}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
