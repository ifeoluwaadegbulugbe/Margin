'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowRight, Eye, RefreshCw } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useProfile } from '@/stores/profile';
import { useSession, runPostSessionStrategist } from '@/stores/session';
import { recommend, type Expedition } from '@/lib/learning/recommender';
import { expeditionFromInsight, watchList } from '@/lib/ai/strategist';
import { levelProgress } from '@/lib/game/levels';
import { localDate } from '@/lib/game/streak';
import { ACHIEVEMENTS } from '@/lib/game/achievements';
import { SKILLS, getSkill } from '@/content';
import { Button, Card, Label, NoteCard, ProgressBar, Ring, Skeleton, cx } from '@/components/ui';
import { AchievementSticker, Spark } from '@/components/game';
import { Scribble } from '@/components/notebook/Scribble';
import { StateTag, TopicGlyph, topicState } from '@/components/notebook/LearningPath';
import { Squiggle, StarDoodle, Tape } from '@/components/notebook/Annotations';
import { ExpeditionSheet } from '@/components/learn/ExpeditionSheet';
import { SourceChip } from '@/components/learn/SourceChip';

export default function DeskPage() {
  return <AppShell><Desk /></AppShell>;
}

function Desk() {
  const router = useRouter();
  const { user, mastery, misconceptions, insight, sessions, achievements, strategistPending } = useProfile();
  const resume = useSession((s) => s.resume);
  const [sheet, setSheet] = useState<Expedition | null>(null);
  const [now] = useState(() => Date.now());

  const expedition = useMemo<Expedition>(() => {
    if (insight) return expeditionFromInsight(insight);
    const counts = Object.fromEntries(Object.entries(misconceptions).map(([k, v]) => [k, v.count]));
    return recommend(mastery, counts, sessions[0]?.problemIds ?? []);
  }, [insight, mastery, misconceptions, sessions]);
  const wl = watchList(insight, misconceptions);
  const active = sessions.find((s) => s.status === 'active' && s.currentState);
  const revise = insight?.output.revision_queue ?? [];

  if (!user) return <div className="space-y-4"><Skeleton className="h-12 w-72" /><Skeleton className="h-60" /></div>;
  const lp = levelProgress(user.xp);
  const today = user.todaySolved.date === localDate() ? user.todaySolved.count : 0;
  const masteredCount = SKILLS.filter((s) => mastery[s.id]?.mastered).length;
  const stale = insight && now - insight.createdAt > 7 * 86400000;
  const recentAch = ACHIEVEMENTS.filter((a) => achievements[a.id]).sort((a, b) => achievements[b.id].unlockedAt - achievements[a.id].unlockedAt).slice(0, 4);
  const continueSkill = getSkill(active?.skillId ?? expedition.skillId);
  const discoveries = SKILLS.map((s) => ({ s, st: topicState(s.id, mastery, revise) })).filter((x) => x.st !== 'complete' && x.st !== 'locked').slice(0, 3);
  const day = new Date().toLocaleDateString(undefined, { weekday: 'long' });
  const fade = (d: number) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay: d, duration: 0.3 } });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Label>{day} · your learning desk</Label>
          <h1 className="mt-2 font-display text-[32px] font-extrabold leading-10 sm:text-[36px]">Ready to figure something out{user.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}?</h1>
          <p className="mt-1 text-ink-2">Your next discovery is waiting.</p>
        </div>
        <Scribble mood="curious" size={72} className="hidden sm:block" />
      </div>

      {!user.calibrated && (
        <NoteCard tone="sun" className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="font-semibold">Do the quick warm-up first</div><div className="text-sm text-ink-2">Six short questions so your first pages fit you.</div></div>
          <Button variant="sun" onClick={() => router.push('/calibrate/')}>Start warm-up</Button>
        </NoteCard>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        <motion.div className="lg:col-span-8" {...fade(0)}>
          <div className="relative overflow-hidden rounded-[24px] bg-violet p-6 text-white shadow-[var(--shadow-floating)] sm:p-8">
            <div className="paper-dots pointer-events-none absolute inset-0 opacity-30" aria-hidden />
            <StarDoodle className="absolute right-6 top-6 h-10 w-10 rotate-12" />
            <Squiggle className="absolute bottom-6 right-24 h-5 w-16" color="var(--sunshine)" />
            <div className="relative">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/75">{active ? 'Continue learning' : 'Your next page'}</div>
              <h2 className="mt-2 font-display text-[28px] font-extrabold leading-9 sm:text-[32px]">The world of algebra</h2>
              <p className="mt-1 text-white/85">{continueSkill?.name}{active ? ` · ${active.currentIndex} of ${active.problemIds.length} challenges done` : ` · ${expedition.problemIds.length} challenges · about ${continueSkill?.minutes ?? 8} min`}</p>
              {!active && (
                <p className={cx('mt-4 max-w-xl font-hand text-[24px] leading-7 text-white', strategistPending && 'opacity-60')}>&ldquo;{expedition.reason}&rdquo;</p>
              )}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => { if (active) { resume(active); router.push('/learn/'); } else setSheet(expedition); }}
                  className="inline-flex h-12 items-center gap-2 rounded-[14px] bg-white px-6 font-semibold text-violet-ink shadow-[0_3px_0_rgba(40,36,59,0.25)] transition-transform hover:-translate-y-px">
                  Open your notebook <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
                {active && <button className="text-sm font-medium text-white/85 underline-offset-4 hover:underline" onClick={() => setSheet(expedition)}>or start a new page</button>}
                {strategistPending && <span className="text-sm text-white/80">Your guide is refining this…</span>}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1" {...fade(0.05)}>
          <Card className="flex flex-col justify-between">
            <Label>Total XP</Label>
            <div className="mt-1 flex items-baseline gap-2"><span className="font-display text-[40px] font-extrabold leading-none tabular">{user.xp}</span><Spark className="h-6 w-6" /></div>
            <ProgressBar className="mt-3" value={lp.pct} right={<span className="text-xs">{lp.toNext} to level {lp.level + 1}</span>} label={<span className="text-xs font-semibold">{lp.rank}</span>} />
          </Card>
          <Card className="flex items-center gap-4">
            <Ring value={today / user.dailyGoal} size={64} color="var(--mint)"><span className="font-display text-sm font-bold tabular">{Math.min(today, user.dailyGoal)}/{user.dailyGoal}</span></Ring>
            <div>
              <Label>Today&apos;s goal</Label>
              <div className="mt-1 text-sm text-ink-2">{today >= user.dailyGoal ? <span className="font-hand text-[22px] text-mint-ink">Done for today!</span> : `${user.dailyGoal - today} more challenge${user.dailyGoal - today > 1 ? 's' : ''} to go`}</div>
              <div className="text-sm text-muted"><span className="font-semibold text-ink tabular">{masteredCount}</span> topic{masteredCount === 1 ? '' : 's'} mastered</div>
            </div>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <motion.div className="lg:col-span-7" {...fade(0.1)}>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-[22px] font-bold">Your next discoveries</h2><Link href="/explore/" className="text-sm font-semibold text-violet-ink">See the path</Link></div>
          <div className="space-y-2.5">
            {discoveries.map(({ s, st }) => (
              <Link key={s.id} href={`/explore/?topic=${s.id}`} className="flex items-center gap-4 rounded-[18px] border border-line bg-white p-3.5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-violet/40">
                <TopicGlyph id={s.id} />
                <span className="min-w-0 flex-1"><span className="block font-semibold">{s.name}</span><span className="block truncate text-sm text-muted">{s.description}</span></span>
                <StateTag state={st} />
              </Link>
            ))}
            {discoveries.length === 0 && <p className="text-ink-2">Everything open is mastered. New topics unlock as you go.</p>}
          </div>
        </motion.div>

        <motion.div className="space-y-5 lg:col-span-5" {...fade(0.15)}>
          <NoteCard tone="lavender" className="p-5">
            <Tape className="absolute -top-2 left-8 rotate-[-6deg]" color="rgba(118,87,232,0.25)" />
            <div className="flex items-center justify-between gap-2">
              <div className="font-hand text-[24px] leading-7 text-violet-ink">Notes from your learning guide</div>
              {insight && <SourceChip source={insight.source as never} latencyMs={insight.latencyMs} />}
            </div>
            {insight ? <p className="mt-2 text-[15px] text-ink">{insight.output.coach_note}</p> : <p className="mt-2 text-[15px] text-ink-2">After a few challenges, your guide will leave notes about your habits here.</p>}
            <div className="mt-3 flex items-start gap-2 text-sm text-ink-2"><Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>Scribble is watching for: {wl.phrases.length ? wl.phrases.join('; ') : 'nothing yet'}</span></div>
            {(stale || (!insight && sessions.length > 0)) && (
              <Button size="sm" variant="secondary" className="mt-3" loading={strategistPending} onClick={() => void runPostSessionStrategist('post_session')} icon={<RefreshCw className="h-3.5 w-3.5" />}>Ask for fresh notes</Button>
            )}
          </NoteCard>
          <Card>
            <div className="flex items-center justify-between"><Label>Recent stickers</Label><Link href="/rewards/" className="text-sm font-semibold text-violet-ink">Collection</Link></div>
            {recentAch.length ? (
              <div className="mt-4 grid grid-cols-4 gap-2">{recentAch.map((a, i) => <AchievementSticker key={a.id} def={a} unlocked size={52} tilt={i % 2 ? 5 : -5} />)}</div>
            ) : <p className="mt-3 text-sm text-ink-2">Solve your first challenge to earn <span className="font-semibold">First Discovery</span>.</p>}
          </Card>
        </motion.div>
      </div>

      <ExpeditionSheet exp={sheet} open={!!sheet} onClose={() => setSheet(null)} />
    </div>
  );
}
