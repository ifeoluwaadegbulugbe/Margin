'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';
import { getProblem, getSkill } from '@/content';
import type { Expedition } from '@/lib/learning/recommender';
import { useSession } from '@/stores/session';
import { Button, Modal, Chip, NoteCard } from '@/components/ui';
import { Spark } from '@/components/game';
import { Statement } from './Math';

export function difficultyWord(d: number) {
  return d === 1 ? 'Warm-up' : d === 2 ? 'Core' : 'Stretch';
}
export function Dots({ n }: { n: number }) {
  return <span className="inline-flex gap-0.5" aria-label={`Difficulty ${n} of 3`}>{[1, 2, 3].map((i) => <span key={i} className={`h-2 w-2 rounded-full ${i <= n ? 'bg-coral' : 'bg-line'}`} />)}</span>;
}

/** "Open your notebook": the short commitment sheet before a challenge set. */
export function ExpeditionSheet({ exp, open, onClose }: { exp: Expedition | null; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const start = useSession((s) => s.start);
  const [busy, setBusy] = useState(false);
  if (!exp) return null;
  const skill = getSkill(exp.skillId);
  const problems = exp.problemIds.map((id) => getProblem(id)).filter(Boolean);
  const max = problems.length * 130;
  return (
    <Modal open={open} onClose={onClose} title={exp.type === 'fix-it' ? `Fix-it page: ${skill?.name}` : skill?.name ?? 'Challenge'}>
      <div className="space-y-4">
        <NoteCard tone="lavender" tilt={-0.6}>
          <div className="font-hand text-[22px] leading-6 text-violet-ink">{exp.source === 'strategist' ? 'A note from your learning guide' : 'Why this one?'}</div>
          <p className="mt-1 text-ink">{exp.reason}</p>
          <p className="mt-1 text-sm text-ink-2">Scribble will watch for: {exp.focus.charAt(0).toLowerCase() + exp.focus.slice(1)}</p>
        </NoteCard>
        <ol className="space-y-2">
          {problems.map((p, i) => (
            <li key={p!.id} className="flex items-center gap-3 rounded-[12px] border border-line bg-white px-3 py-2.5">
              <span className="font-hand text-xl text-muted">{i + 1}.</span>
              <span className="min-w-0 flex-1 truncate"><Statement latex={p!.latex} statement={p!.statement} /></span>
              <Dots n={p!.difficulty} /><span className="w-14 text-xs text-muted">{difficultyWord(p!.difficulty)}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-3 text-sm text-ink-2">
          <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />about {skill?.minutes ?? 8} min</span>
          <Chip tone="sun"><Spark /> up to {max} XP</Chip>
        </div>
        {skill && <p className="text-sm text-ink-2"><span className="font-semibold text-ink">By the end you&apos;ll be able to:</span> {skill.objectives.join('; ').toLowerCase()}.</p>}
        <Button className="w-full" size="lg" loading={busy} onClick={async () => {
          setBusy(true);
          await start(exp);
          router.push('/learn/');
        }}>Open your notebook →</Button>
      </div>
    </Modal>
  );
}
