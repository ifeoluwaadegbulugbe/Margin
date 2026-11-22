'use client';
import { useState } from 'react';
import { Flame, RefreshCw } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useProfile } from '@/stores/profile';
import { runPostSessionStrategist } from '@/stores/session';
import { SKILLS, getProblem, getSkill } from '@/content';
import { MISCONCEPTIONS, isMisconceptionId } from '@/content/misconceptions';
import { explainMastery } from '@/lib/game/mastery';
import { displayStreak, localDate } from '@/lib/game/streak';
import { Button, Card, Chip, Label, NoteCard, ProgressBar } from '@/components/ui';
import { Scribble } from '@/components/notebook/Scribble';
import { TopicGlyph } from '@/components/notebook/LearningPath';
import { Tape } from '@/components/notebook/Annotations';
import { SourceChip } from '@/components/learn/SourceChip';

export default function ProgressPage() {
  return <AppShell><Progress /></AppShell>;
}

function Progress() {
  const { user, mastery, sessions, misconceptions, insight, strategistPending } = useProfile();
  const [cooldown, setCooldown] = useState(false);
  if (!user) return null;

  const days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return localDate(d);
  });
  const perDay = days.map((d) => sessions.filter((s) => localDate(new Date(s.startedAt)) === d).reduce((a, s) => a + s.problems.filter((p) => p.solved).length, 0));
  const maxDay = Math.max(1, ...perDay);
  const mastered = SKILLS.filter((s) => mastery[s.id]?.mastered);
  const practice = SKILLS.filter((s) => !mastery[s.id]?.mastered && (mastery[s.id]?.attempts ?? 0) > 0).sort((a, b) => (mastery[a.id]?.value ?? 0) - (mastery[b.id]?.value ?? 0));
  const streak = displayStreak(user.streak, localDate());
  const habits = Object.entries(misconceptions).sort((a, b) => b[1].count - a[1].count);

  const ask = async (type: 'weekly' | 'post_session') => {
    setCooldown(true);
    setTimeout(() => setCooldown(false), 60000);
    await runPostSessionStrategist(type);
  };

  return (
    <div className="space-y-8">
      <div>
        <Label>Progress journal</Label>
        <h1 className="mt-2 font-display text-[32px] font-extrabold leading-10 sm:text-[36px]">How your thinking is growing</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card><Label>Topics mastered</Label><div className="mt-1 font-display text-[36px] font-extrabold tabular">{mastered.length}<span className="text-lg text-muted">/{SKILLS.length}</span></div></Card>
        <Card><Label>Learning streak</Label><div className="mt-1 flex items-center gap-1 font-display text-[36px] font-extrabold tabular">{streak.count}<Flame className="h-6 w-6 text-coral" aria-hidden /></div></Card>
        <Card><Label>Challenges solved</Label><div className="mt-1 font-display text-[36px] font-extrabold tabular">{user.stats.solved}</div></Card>
        <Card><Label>Fixed your own mistakes</Label><div className="mt-1 font-display text-[36px] font-extrabold tabular">{user.stats.selfCorrections}</div></Card>
      </div>

      <div className="relative rounded-[24px] border border-violet/25 bg-lavender p-6 shadow-[var(--shadow-card)] sm:p-8">
        <Tape className="absolute -top-2 left-10 rotate-[-4deg]" color="rgba(255,189,89,0.6)" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Scribble mood="thinking" size={56} />
            <div>
              <h2 className="font-hand text-[30px] leading-8 text-violet-ink">Notes from your learning guide</h2>
              <p className="text-sm text-ink-2">Written in the cloud from your scores, hint levels and mistake types, never from what you type.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {insight && <SourceChip source={insight.source as never} latencyMs={insight.latencyMs} />}
            <Button size="sm" variant="secondary" loading={strategistPending} disabled={cooldown || sessions.length === 0} onClick={() => void ask('weekly')} icon={<RefreshCw className="h-3.5 w-3.5" />}>Write my weekly note</Button>
          </div>
        </div>
        {!insight ? (
          <p className="mt-5 text-ink-2">{sessions.length ? 'No notes yet. Ask for one, or finish another challenge.' : 'Finish a challenge and your guide will start writing notes here.'}</p>
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <p className="text-[17px] leading-7 text-ink">{insight.output.coach_note}</p>
              {insight.output.strengths.length > 0 && (
                <>
                  <div className="mt-4 font-hand text-[22px] text-mint-ink">What you&apos;re doing well</div>
                  <ul className="mt-1 list-disc pl-5 text-ink-2">{insight.output.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
                </>
              )}
              <div className="mt-4 font-hand text-[22px] text-violet-ink">Suggested next</div>
              <p className="text-ink-2"><span className="font-semibold text-ink">{getSkill(insight.output.next_expedition.skill_id)?.name}</span>: {insight.output.next_expedition.reason}</p>
              <p className="mt-1 font-mono text-sm text-muted">{insight.output.next_expedition.problem_ids.map((id) => getProblem(id)?.statement ?? id).join('  ·  ')}</p>
              {insight.adjustments.length > 0 && (
                <details className="mt-3 text-sm text-muted"><summary className="cursor-pointer">The app checked {insight.adjustments.length} claim(s) against your real data</summary><ul className="mt-1 list-disc pl-5">{insight.adjustments.map((a) => <li key={a}>{a}</li>)}</ul></details>
              )}
            </div>
            <div className="space-y-3">
              {insight.output.recurring_misconceptions.map((m) => (
                <NoteCard key={m.id} tone="white" className="p-4">
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold">{isMisconceptionId(m.id) ? MISCONCEPTIONS[m.id].name : m.id}</span><Chip tone={m.severity === 'high' ? 'coral' : m.severity === 'medium' ? 'sun' : 'neutral'}>{m.severity}</Chip></div>
                  <p className="mt-1 text-sm text-ink-2">{m.student_explanation}</p>
                  <p className="mt-1 text-xs tabular text-muted">Seen {m.evidence_count}× in {m.sessions_seen} session{m.sessions_seen === 1 ? '' : 's'} · Scribble now watches for this</p>
                </NoteCard>
              ))}
              {insight.output.recurring_misconceptions.length === 0 && <p className="text-ink-2">No recurring habits spotted.</p>}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <Label>Topic mastery</Label>
          <div className="mt-4 space-y-4">
            {SKILLS.map((s) => (
              <div key={s.id} className="flex items-start gap-3">
                <TopicGlyph id={s.id} size={36} />
                <div className="min-w-0 flex-1">
                  <ProgressBar value={mastery[s.id]?.value ?? 0} label={s.name} right={`${Math.round((mastery[s.id]?.value ?? 0) * 100)}%`} color={mastery[s.id]?.mastered ? 'mint' : 'violet'} />
                  <p className="mt-1 text-xs text-muted">{mastery[s.id] ? explainMastery(mastery[s.id]) : 'Not started.'}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <div className="space-y-5 lg:col-span-5">
          <Card>
            <Label>Challenges solved, last 7 days</Label>
            <div className="mt-4 flex h-32 items-end gap-2" role="img" aria-label={`Challenges solved per day: ${perDay.join(', ')}`}>
              {perDay.map((n, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs tabular text-muted">{n || ''}</span>
                  <div className="w-full max-w-8 rounded-t-[6px] bg-violet" style={{ height: `${(n / maxDay) * 92}px`, minHeight: n ? 4 : 2, opacity: n ? 1 : 0.15 }} />
                  <span className="text-xs text-muted">{new Date(days[i]).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <Label>Needs more practice</Label>
            {practice.length ? <ul className="mt-2 space-y-1">{practice.map((s) => <li key={s.id} className="flex justify-between text-ink-2"><span>{s.name}</span><span className="tabular text-muted">{Math.round((mastery[s.id]?.value ?? 0) * 100)}%</span></li>)}</ul> : <p className="mt-2 text-sm text-ink-2">Nothing flagged right now.</p>}
            <Label className="mt-5">Recurring mistakes</Label>
            {habits.length ? (
              <ul className="mt-2 space-y-1 text-sm">{habits.map(([id, m]) => <li key={id} className="flex justify-between gap-3"><span className="text-ink-2">{isMisconceptionId(id) ? MISCONCEPTIONS[id].name : id}{m.beaten ? ' · beaten!' : ''}</span><span className="tabular text-muted">{m.count}×</span></li>)}</ul>
            ) : <p className="mt-2 text-sm text-ink-2">None yet.</p>}
          </Card>
        </div>
      </div>

      <Card>
        <Label>Session history</Label>
        {sessions.length === 0 ? <p className="mt-2 text-ink-2">No sessions yet.</p> : (
          <ul className="mt-3 divide-y divide-line">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="flex items-center gap-3"><TopicGlyph id={s.skillId} size={30} /><span className="font-semibold">{getSkill(s.skillId)?.name}</span></span>
                <span className="text-sm text-muted">{new Date(s.startedAt).toLocaleDateString()} · {s.status === 'complete' ? `${s.problems.filter((p) => p.solved).length}/${s.problems.length} solved · +${s.xpEarned} XP` : 'in progress'}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
