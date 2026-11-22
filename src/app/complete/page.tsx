'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { AuthGuard } from '@/components/layout/AppShell';
import { useSession } from '@/stores/session';
import { useProfile } from '@/stores/profile';
import { getProblem, getSkill } from '@/content';
import { rankTitle } from '@/lib/game/levels';
import { explainMastery } from '@/lib/game/mastery';
import { recommend, type Expedition } from '@/lib/learning/recommender';
import { expeditionFromInsight } from '@/lib/ai/strategist';
import { Card, Label, NoteCard, cx } from '@/components/ui';
import { AchievementReveal, CountUp, LevelUpOverlay, MasteryStamp, Spark, burst } from '@/components/game';
import { Scribble, Wordmark } from '@/components/notebook/Scribble';
import { CheckDoodle, Tape, Underline } from '@/components/notebook/Annotations';
import { Statement } from '@/components/learn/Math';
import { SourceChip } from '@/components/learn/SourceChip';
import { ExpeditionSheet } from '@/components/learn/ExpeditionSheet';

function Complete() {
  const router = useRouter();
  const completion = useSession((s) => s.completion);
  const session = useSession((s) => s.session);
  const clear = useSession((s) => s.clear);
  const { insight, strategistPending, mastery, misconceptions } = useProfile();
  const [showAch, setShowAch] = useState(true);
  const [showLevel, setShowLevel] = useState(true);
  const [why, setWhy] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Expedition | null>(null);

  const [arrivedWith] = useState(() => completion);
  useEffect(() => {
    // only bounce when the page was opened without a finished chapter (starting the next one clears it)
    if (!arrivedWith) router.replace('/desk/');
  }, [arrivedWith, router]);
  useEffect(() => {
    if (completion && session?.problems.some((p) => p.solved && p.hintMax === 0)) void burst(40);
  }, [completion, session]);

  const next = useMemo<Expedition>(() => {
    const fresh = insight && session?.endedAt && insight.createdAt >= session.endedAt - 1000 ? insight : null;
    if (fresh) return expeditionFromInsight(fresh);
    return recommend(mastery, Object.fromEntries(Object.entries(misconceptions).map(([k, v]) => [k, v.count])), session?.problemIds ?? []);
  }, [insight, session, mastery, misconceptions]);

  if (!completion || !session || session.status !== 'complete') return null;
  const levelUp = completion.levelAfter > completion.levelBefore;
  const freshInsight = insight && insight.createdAt >= (session.endedAt ?? 0) - 1000 ? insight : null;
  const solved = session.problems.filter((p) => p.solved);
  const independent = solved.filter((p) => p.hintMax <= 1).length;
  const skill = getSkill(session.skillId);
  const counts = session.inferenceCounts;
  const nextSkill = getSkill(next.skillId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between"><Wordmark /><span className="font-hand text-xl text-muted">{new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</span></div>

      <div className="paper-ruled paper-margin relative mt-8 rounded-[24px] border border-line px-6 py-8 pl-16 shadow-[var(--shadow-floating)] sm:px-10 sm:pl-20">
        <Tape className="absolute -top-2 left-1/2 -translate-x-1/2 rotate-[-2deg]" />
        <div className="absolute -top-9 right-6"><Scribble mood="celebrating" size={80} /></div>
        <Label>Chapter complete · {skill?.name}</Label>
        <h1 className="relative mt-2 inline-block font-display text-[34px] font-extrabold leading-10 sm:text-[40px] sm:leading-[46px]">
          You earned every answer.<Underline className="absolute -bottom-2 left-0 h-3 w-full" color="var(--mint)" delay={0.3} />
        </h1>

        <div className="mt-8 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-start">
          <div>
            <Label>The problems</Label>
            <ul className="mt-2 space-y-1">
              {session.problems.map((p) => {
                const prob = getProblem(p.id);
                return (
                  <li key={p.id} className="flex items-center gap-3 py-1">
                    {p.solved ? <CheckDoodle className="h-6 w-6" /> : <span className="h-6 w-6 text-center font-hand text-xl text-muted">–</span>}
                    <span className="min-w-0 flex-1 truncate text-[17px]">{prob?.latex ? <Statement latex={prob.latex} statement={prob.statement} /> : prob?.statement}</span>
                    <span className="font-hand text-[18px] text-muted">{p.solved ? (p.hintMax === 0 ? 'no hints!' : `${p.hintMax} hint${p.hintMax > 1 ? 's' : ''}`) : 'skipped'}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="text-center">
            <Label>XP earned</Label>
            <div className="mt-1 flex items-center justify-center gap-1 font-display text-[56px] font-extrabold leading-none text-violet-ink">+<CountUp value={completion.total} /><Spark className="h-8 w-8" /></div>
            <p className="mt-1 text-sm text-ink-2">now <span className="tabular font-semibold text-ink">{completion.xpAfter}</span> · {rankTitle(completion.levelAfter)}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <NoteCard tone="lavender" tilt={-0.8}>
            <div className="font-hand text-[22px] text-violet-ink">Independent thinking</div>
            <div className="mt-2 flex gap-1.5" aria-label={`${independent} of ${session.problems.length} solved with at most one hint`}>
              {session.problems.map((p, i) => <span key={i} className={cx('h-3 flex-1 rounded-full', p.solved && p.hintMax <= 1 ? 'bg-violet' : p.solved ? 'bg-violet/35' : 'bg-line')} />)}
            </div>
            <p className="mt-2 text-sm text-ink-2"><span className="font-semibold text-ink tabular">{independent} of {session.problems.length}</span> solved with one hint or fewer.</p>
          </NoteCard>
          <NoteCard tone="mint" tilt={0.8}>
            <div className="font-hand text-[22px] text-mint-ink">What you learned</div>
            <ul className="mt-1 list-disc pl-5 text-sm text-ink-2">{skill?.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
          </NoteCard>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <Label>How XP was earned</Label>
          <ul className="mt-3 divide-y divide-line">
            {completion.tx.map((t, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.04 }} className="flex items-center justify-between gap-3 py-1.5 text-[14px]">
                <span className="text-ink-2">{t.detail}{t.problemId ? <span className="text-muted"> · {t.problemId}</span> : null}</span>
                <span className="font-display font-bold tabular text-ink">+{t.amount}</span>
              </motion.li>
            ))}
            {completion.tx.length === 0 && <li className="py-2 text-sm text-ink-2">No XP this time. Every attempt still teaches the checker and your guide something.</li>}
          </ul>
          <p className="mt-3 text-xs text-muted">XP comes from reasoning only: balanced lines, solving (× hint multiplier), fixing your own mistakes, explaining and transfer. Messages and hints earn nothing.</p>
        </Card>
        <div className="space-y-4">
          <Card>
            <Label>Topic progress</Label>
            {completion.masteryDelta.map((m) => (
              <div key={m.skillId} className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{getSkill(m.skillId)?.name}</div>
                  <div className="tabular text-sm text-ink-2">{Math.round(m.before * 100)}% → <span className="font-semibold text-ink">{Math.round(m.after * 100)}%</span> · <button className="font-semibold text-violet-ink" onClick={() => setWhy(mastery[m.skillId] ? explainMastery(mastery[m.skillId]) : null)}>why?</button></div>
                </div>
                {m.mastered && <MasteryStamp size={76} animate />}
              </div>
            ))}
            {why && <p className="mt-3 rounded-[10px] bg-warm p-3 text-sm text-ink-2">{why}</p>}
          </Card>
          <NoteCard tone="white">
            <div className="flex items-center justify-between gap-2">
              <div className="font-hand text-[22px] text-violet-ink">Note from your learning guide</div>
              {freshInsight ? <SourceChip source={freshInsight.source as never} latencyMs={freshInsight.latencyMs} /> : null}
            </div>
            <p className={cx('mt-1 text-[15px]', strategistPending && !freshInsight && 'shimmer rounded-md text-transparent')}>
              {freshInsight ? freshInsight.output.coach_note : strategistPending ? 'Your guide is reading this session…' : 'Your guide is unavailable right now, so the next page uses the built-in plan.'}
            </p>
            <p className="mt-2 text-xs text-muted">Scribble this session: {counts.onDevice} on-device · {counts.cloud} cloud · {counts.scripted} offline script.</p>
          </NoteCard>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[24px] bg-violet p-6 text-white shadow-[var(--shadow-floating)]">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/75">Recommended next</div>
          <div className="mt-1 font-display text-xl font-extrabold">{nextSkill?.name}</div>
          <div className="text-sm text-white/85">{next.reason}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSheet(next)} className="inline-flex h-11 items-center rounded-[14px] bg-white px-5 font-semibold text-violet-ink">Start next challenge</button>
          <button onClick={() => { clear(); router.push('/desk/'); }} className="inline-flex h-11 items-center rounded-[14px] px-4 font-semibold text-white hover:bg-white/10">Back to my desk</button>
        </div>
      </div>
      <p className="mt-4 text-center text-sm"><Link href="/notebook/" className="font-semibold text-violet-ink">See this page in My notebook</Link></p>

      <ExpeditionSheet exp={sheet} open={!!sheet} onClose={() => setSheet(null)} />
      {levelUp && showLevel && !(showAch && completion.achievements.length) && (
        <LevelUpOverlay level={completion.levelAfter} rank={rankTitle(completion.levelAfter)} xp={completion.xpAfter} onClose={() => setShowLevel(false)} />
      )}
      {showAch && <AchievementReveal queue={completion.achievements} onDone={() => setShowAch(false)} />}
    </div>
  );
}

export default function CompletePage() {
  return <AuthGuard><Complete /></AuthGuard>;
}
