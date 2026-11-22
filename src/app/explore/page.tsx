'use client';
import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lock } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useProfile } from '@/stores/profile';
import { SKILLS, getSkill, CONSTELLATION } from '@/content';
import { isUnlocked, explainMastery } from '@/lib/game/mastery';
import { recommend, expeditionForSkill, type Expedition } from '@/lib/learning/recommender';
import { expeditionFromInsight } from '@/lib/ai/strategist';
import { Button, Card, Label, NoteCard, ProgressBar, cx } from '@/components/ui';
import { MasteryStamp } from '@/components/game';
import { LearningPath, StateTag, TopicGlyph, topicState } from '@/components/notebook/LearningPath';
import { ExpeditionSheet, Dots, difficultyWord } from '@/components/learn/ExpeditionSheet';

const SUBJECTS = [
  { id: 'maths', name: 'Mathematics', live: true, accent: 'bg-violet text-white' },
  { id: 'science', name: 'Science', live: false, accent: '' },
  { id: 'language', name: 'Language', live: false, accent: '' },
  { id: 'computing', name: 'Computing', live: false, accent: '' },
];

export default function ExplorePage() {
  return <AppShell><Suspense><Explore /></Suspense></AppShell>;
}

function Explore() {
  const params = useSearchParams();
  const { mastery, insight, misconceptions } = useProfile();
  const [selected, setSelected] = useState<string>(() => {
    const t = params.get('topic');
    return t && getSkill(t) ? t : SKILLS[0].id;
  });
  const [sheet, setSheet] = useState<Expedition | null>(null);
  const recommended = useMemo(() => (insight ? expeditionFromInsight(insight).skillId : recommend(mastery).skillId), [insight, mastery]);
  const revise = insight?.output.revision_queue ?? [];
  const s = getSkill(selected)!;
  const m = mastery[s.id];
  const st = topicState(s.id, mastery, revise);
  const unlocked = isUnlocked(s.prerequisites, mastery);

  const practise = () => {
    const counts = Object.fromEntries(Object.entries(misconceptions).map(([k, v]) => [k, v.count]));
    setSheet(expeditionForSkill(s.id, mastery, counts));
  };

  return (
    <div className="space-y-8">
      <div>
        <Label>Explore</Label>
        <h1 className="mt-2 font-display text-[32px] font-extrabold leading-10 sm:text-[36px]">Where to next?</h1>
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Subjects">
          {SUBJECTS.map((sub) => (
            <button key={sub.id} role="tab" aria-selected={sub.live} disabled={!sub.live}
              className={cx('rounded-t-[14px] border border-b-0 px-4 py-2 text-sm font-semibold', sub.live ? sub.accent : 'border-line bg-warm text-muted')}>
              {sub.name}{!sub.live && <span className="ml-1.5 font-normal">· soon</span>}
            </button>
          ))}
        </div>
        <div className="rounded-b-[24px] rounded-tr-[24px] border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-[24px] font-bold">{CONSTELLATION.name}</h2>
            <span className="font-hand text-[20px] text-coral-ink">5 topics · one path to solving equations</span>
          </div>
          <div className="mt-6"><LearningPath mastery={mastery} selected={selected} onSelect={setSelected} recommended={recommended} revise={revise} /></div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <div className="flex items-start gap-4">
            <TopicGlyph id={s.id} size={64} dim={!unlocked} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-[24px] font-bold leading-8">{s.name}</h2><StateTag state={st} /></div>
              <p className="mt-1 text-ink-2">{s.description}</p>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted"><Dots n={s.difficulty} />{difficultyWord(s.difficulty)} · about {s.minutes} min</div>
            </div>
            {m?.mastered && <MasteryStamp size={80} />}
          </div>
          <ProgressBar className="mt-6" value={m?.value ?? 0} label="Mastery" right={`${Math.round((m?.value ?? 0) * 100)}%`} color={m?.mastered ? 'mint' : 'violet'} />
          <p className="mt-2 text-sm text-muted">{m ? explainMastery(m) : 'No challenges yet.'}</p>
          <div className="mt-6">
            {unlocked ? <Button onClick={practise}>Practise this topic</Button> : (
              <span className="inline-flex items-center gap-2 text-sm text-ink-2"><Lock className="h-4 w-4" aria-hidden />Reach 60% in {s.prerequisites.map((p) => getSkill(p)?.name).join(' and ')} to unlock</span>
            )}
          </div>
        </Card>
        <NoteCard tone="sun" tilt={0.8} className="p-6 lg:col-span-5">
          <div className="font-hand text-[24px] text-sun-ink">In this topic you&apos;ll…</div>
          <ul className="mt-2 space-y-1.5">{s.objectives.map((o) => <li key={o} className="flex gap-2 text-ink"><span className="text-coral-ink">✦</span>{o}</li>)}</ul>
          {s.prerequisites.length > 0 && <p className="mt-4 text-sm text-ink-2">Builds on: {s.prerequisites.map((p) => getSkill(p)?.name).join(', ')}</p>}
          {revise.includes(s.id) && <p className="mt-3 font-hand text-[20px] text-coral-ink">Your guide suggests revising this one.</p>}
        </NoteCard>
      </div>
      <ExpeditionSheet exp={sheet} open={!!sheet} onClose={() => setSheet(null)} />
    </div>
  );
}
