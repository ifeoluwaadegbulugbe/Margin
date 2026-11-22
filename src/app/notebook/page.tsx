'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useProfile } from '@/stores/profile';
import { useSession } from '@/stores/session';
import { coreProblems, getProblem, getSkill } from '@/content';
import { MISCONCEPTIONS, isMisconceptionId } from '@/content/misconceptions';
import { Button, EmptyState, Label, Modal, NoteCard, cx } from '@/components/ui';
import { Scribble } from '@/components/notebook/Scribble';
import { CheckDoodle, CornerFold } from '@/components/notebook/Annotations';
import { TopicGlyph } from '@/components/notebook/LearningPath';
import { Statement } from '@/components/learn/Math';
import type { SessionRecord } from '@/types/domain';

type Tab = 'pages' | 'mistakes' | 'concepts';

export default function NotebookPage() {
  return <AppShell><Notebook /></AppShell>;
}

function Notebook() {
  const router = useRouter();
  const { sessions, misconceptions } = useProfile();
  const start = useSession((s) => s.start);
  const [tab, setTab] = useState<Tab>('pages');
  const [open, setOpen] = useState<SessionRecord | null>(null);
  const pages = sessions.filter((s) => s.status === 'complete');
  const mistakes = pages.flatMap((s) => s.problems.flatMap((p) => p.errors.map((e) => ({ ...e, problemId: p.id, sessionId: s.id, at: s.startedAt }))));
  const concepts = Object.entries(misconceptions).filter(([id]) => isMisconceptionId(id)).sort((a, b) => b[1].count - a[1].count);

  const retrySimilar = async (misconception: string | null, problemId: string) => {
    const p = getProblem(problemId);
    if (!p) return;
    const pool = coreProblems(p.skillId).filter((q) => q.id !== problemId);
    const target = pool.find((q) => misconception && q.tags.includes(misconception)) ?? pool[0];
    if (!target) return;
    await start({ skillId: p.skillId, problemIds: [target.id], reason: 'Try a similar one.', focus: misconception && isMisconceptionId(misconception) ? MISCONCEPTIONS[misconception].concept : 'Check each line balances.', source: 'rules', type: 'single' });
    router.push('/learn/');
  };

  const TABS: { id: Tab; label: string; n: number }[] = [
    { id: 'pages', label: 'Completed pages', n: pages.length },
    { id: 'mistakes', label: 'Mistakes worth revisiting', n: mistakes.length },
    { id: 'concepts', label: 'Important ideas', n: concepts.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Label>My notebook</Label>
          <h1 className="mt-2 font-display text-[32px] font-extrabold leading-10 sm:text-[36px]">Everything you&apos;ve worked out</h1>
        </div>
        <Scribble mood="encouraging" size={64} className="hidden sm:block" />
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Notebook sections">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cx('rounded-[12px] border px-3.5 py-2 text-sm font-semibold transition-colors', tab === t.id ? 'border-violet bg-lavender text-violet-ink' : 'border-line bg-white text-ink-2 hover:border-violet/40')}>
            {t.label} <span className="tabular text-muted">{t.n}</span>
          </button>
        ))}
      </div>

      {tab === 'pages' && (pages.length === 0 ? (
        <EmptyState art={<Scribble mood="curious" size={72} />} title="Your notebook is empty for now. Finish your first challenge and it becomes your first page." cta={<Button onClick={() => router.push('/desk/')}>Go to my desk</Button>} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((s, i) => {
            const solved = s.problems.filter((p) => p.solved).length;
            const clean = s.problems.every((p) => p.errors.length === 0 && p.hintMax === 0);
            return (
              <button key={s.id} onClick={() => setOpen(s)}
                className="paper-ruled paper-margin group relative min-h-[210px] rounded-[18px] border border-line p-5 pl-14 text-left shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-floating)]"
                style={{ transform: `rotate(${[-0.6, 0.5, -0.3][i % 3]}deg)` }}>
                <CornerFold className="absolute right-0 top-0 h-6 w-6" />
                <div className="font-hand text-[20px] text-muted">{new Date(s.startedAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                <div className="mt-2 flex items-center gap-2"><TopicGlyph id={s.skillId} size={32} /><span className="font-display text-lg font-bold leading-6">{getSkill(s.skillId)?.name}</span></div>
                <p className="mt-3 text-sm text-ink-2">{solved}/{s.problems.length} solved · +{s.xpEarned} XP</p>
                <p className="text-sm text-ink-2">{s.problems.reduce((a, p) => a + p.errors.length, 0)} mistake(s) on the page</p>
                {clean && <span className="absolute bottom-4 right-4 rotate-[-10deg] rounded-full border-2 border-double border-mint-ink px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-mint-ink">clean page</span>}
              </button>
            );
          })}
        </div>
      ))}

      {tab === 'mistakes' && (mistakes.length === 0 ? (
        <EmptyState art={<CheckDoodle className="h-12 w-12" />} title="No mistakes to revisit. Clean pages so far." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {mistakes.map((e, i) => {
            const p = getProblem(e.problemId);
            const m = e.misconception && isMisconceptionId(e.misconception) ? MISCONCEPTIONS[e.misconception] : null;
            return (
              <NoteCard key={i} tone={e.fixedBySelf ? 'white' : 'coral'} tilt={i % 2 ? 0.5 : -0.5}>
                <div className="flex items-center justify-between gap-2 text-sm text-muted"><span className="truncate">{p?.latex ? <Statement latex={p.latex} statement={p.statement} /> : p?.statement}</span><span>line {e.line}</span></div>
                <div className={cx('mt-2 font-mono text-[18px]', e.fixedBySelf && 'line-through decoration-coral decoration-2')}>{e.text}</div>
                <p className="mt-1 font-hand text-[20px] leading-6 text-coral-ink">{e.fixedBySelf ? 'You caught this one yourself.' : e.message}</p>
                {m && <p className="mt-2 text-sm"><span className="font-semibold">{m.name}.</span> <span className="text-ink-2">{m.concept}</span></p>}
                <Button size="sm" variant="secondary" className="mt-3" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => void retrySimilar(e.misconception, e.problemId)}>Try a similar one</Button>
              </NoteCard>
            );
          })}
        </div>
      ))}

      {tab === 'concepts' && (concepts.length === 0 ? (
        <EmptyState title="Important ideas you've wrestled with will be collected here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {concepts.map(([id, c], i) => {
            const m = MISCONCEPTIONS[id as keyof typeof MISCONCEPTIONS];
            return (
              <NoteCard key={id} tone={(['lavender', 'mint', 'blue', 'sun'] as const)[i % 4]} tilt={i % 2 ? 0.6 : -0.6} className="p-5">
                <div className="font-hand text-[24px] leading-7">{m.concept}</div>
                <p className="mt-2 text-sm text-ink-2">Remember this when you notice: {m.name.toLowerCase()}.</p>
                <p className="mt-1 text-xs text-muted tabular">Seen {c.count}× in {c.sessions.length} session{c.sessions.length === 1 ? '' : 's'}{c.beaten ? ' · beaten!' : ''}</p>
              </NoteCard>
            );
          })}
        </div>
      ))}

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? getSkill(open.skillId)?.name ?? 'Page' : ''}>
        {open && (
          <div className="space-y-3">
            <p className="font-hand text-[20px] text-muted">{new Date(open.startedAt).toLocaleString()}</p>
            {open.problems.map((p) => {
              const prob = getProblem(p.id);
              return (
                <div key={p.id} className="rounded-[14px] border border-line bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{prob?.latex ? <Statement latex={prob.latex} statement={prob.statement} /> : prob?.statement}</span>
                    {p.solved ? <CheckDoodle className="h-6 w-6 shrink-0" /> : <span className="text-sm text-muted">unsolved</span>}
                  </div>
                  <p className="mt-1 text-sm text-ink-2">{p.hintMax === 0 ? 'No hints' : `Up to hint ${p.hintMax}`} · explanation {p.explanation} · {Math.round(p.secs / 60) || '<1'} min</p>
                  {p.errors.map((e, i) => <p key={i} className="mt-1 font-mono text-sm text-coral-ink">line {e.line}: {e.text}{e.fixedBySelf ? ' (fixed)' : ''}</p>)}
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
