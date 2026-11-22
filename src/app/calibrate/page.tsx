'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { AuthGuard } from '@/components/layout/AppShell';
import { getProblem, SKILLS } from '@/content';
import { verifyFinal } from '@/lib/learning/verify';
import { emptyMastery } from '@/lib/game/mastery';
import { useProfile } from '@/stores/profile';
import { runPostSessionStrategist } from '@/stores/session';
import { Button, cx } from '@/components/ui';
import { Statement } from '@/components/learn/Math';
import { Scribble } from '@/components/notebook/Scribble';
import { TopicGlyph } from '@/components/notebook/LearningPath';

const ITEMS: Record<string, [string, string]> = {
  'neg-numbers': ['NN-02', 'NN-01'],
  'order-ops': ['OO-03', 'OO-01'],
  fractions: ['FR-02', 'FR-01'],
  'two-step': ['TS-03', 'TS-02'],
  'multi-step': ['MS-02', 'MS-01'],
};
const MAX = 6;
type Answer = 'correct' | 'wrong' | 'unsure';
const SCORE: Record<Answer, number> = { correct: 0.6, wrong: 0.1, unsure: 0 };

function Calibrate() {
  const router = useRouter();
  const { setMastery, update } = useProfile();
  const [results, setResults] = useState<Record<string, Answer[]>>({});
  const [asked, setAsked] = useState(0);
  const [skillIdx, setSkillIdx] = useState(0);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [phase, setPhase] = useState<'asking' | 'planning'>('asking');

  const skill = SKILLS[skillIdx];
  const tries = skill ? results[skill.id]?.length ?? 0 : 0;
  const problem = skill ? getProblem(ITEMS[skill.id][Math.min(tries, 1)]) : null;

  const finish = async (final: Record<string, Answer[]>) => {
    setPhase('planning');
    const seeds = Object.fromEntries(SKILLS.map((s) => {
      const r = final[s.id] ?? [];
      const v = r.length ? r.reduce((a, x) => a + SCORE[x], 0) / r.length : 0;
      return [s.id, { ...emptyMastery(Math.round(v * 100) / 100) }];
    }));
    await setMastery(seeds);
    await update({ calibrated: true });
    // the Learning Guide plans the first pages; never block the student for more than 10 s
    await Promise.race([runPostSessionStrategist('first_route'), new Promise((r) => setTimeout(r, 10000))]);
    router.push('/desk/');
  };

  const advance = (answer: Answer) => {
    if (!skill) return;
    const r = { ...results, [skill.id]: [...(results[skill.id] ?? []), answer] };
    setResults(r);
    const n = asked + 1;
    setAsked(n);
    setValue('');
    setMsg(answer === 'correct' ? 'Nice!' : answer === 'unsure' ? 'No problem, that helps too.' : null);
    const mine = r[skill.id];
    let moveOn = answer === 'correct' || mine.length >= 2;
    let nextBlocked = blocked;
    if (mine.length >= 2 && mine.every((a) => a !== 'correct')) {
      // two misses: stop this branch (skip topics that depend on it)
      nextBlocked = new Set([...blocked, ...SKILLS.filter((s) => s.prerequisites.includes(skill.id)).map((s) => s.id)]);
      setBlocked(nextBlocked);
      moveOn = true;
    }
    if (n >= MAX) return void finish(r);
    if (moveOn) {
      let i = skillIdx + 1;
      while (i < SKILLS.length && (nextBlocked.has(SKILLS[i].id) || SKILLS[i].prerequisites.some((p) => nextBlocked.has(p)))) i++;
      if (i >= SKILLS.length) return void finish(r);
      setSkillIdx(i);
    }
  };

  if (phase === 'planning') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <Scribble mood="thinking" size={88} />
        <h1 className="font-display text-[28px] font-extrabold">Planning your first pages…</h1>
        <p className="max-w-md text-ink-2">Your learning guide runs in the cloud and only sees your scores, never your typing.</p>
      </div>
    );
  }
  if (!problem || !skill) return null;
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-10">
      <div className="mb-3 flex items-center justify-between text-sm text-ink-2">
        <span className="font-hand text-[24px] text-coral-ink">Quick warm-up</span><span className="tabular">{asked + 1} / {MAX}</span>
      </div>
      <div className="mb-6 flex gap-2" aria-hidden>
        {SKILLS.map((s) => {
          const r = results[s.id];
          return <span key={s.id} className={cx('h-2 flex-1 rounded-full', r ? (r.includes('correct') ? 'bg-mint' : 'bg-sunshine') : s.id === skill.id ? 'bg-violet' : 'bg-line')} title={s.name} />;
        })}
      </div>
      <motion.div key={problem.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="paper-grid rounded-[24px] border border-line p-6 shadow-[var(--shadow-floating)] sm:p-8">
        <div className="flex items-center gap-3">
          <TopicGlyph id={skill.id} size={40} />
          <div><div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{skill.name}</div><div className="text-sm text-ink-2">Answer only, no hints. It&apos;s fine not to know.</div></div>
        </div>
        <div className={cx('my-7', problem.latex ? 'text-[30px]' : 'text-lg')}>
          {problem.verifier === 'linearEquation' && problem.latex && <span className="mr-2 text-base text-muted">Solve</span>}
          <Statement latex={problem.latex} statement={problem.statement} />
        </div>
        <form onSubmit={(e) => {
          e.preventDefault();
          const r = verifyFinal(problem, value);
          if (!r.readable) { setMsg(r.message); return; }
          advance(r.correct || r.notSimplest ? 'correct' : 'wrong');
        }} className="flex gap-2">
          <label htmlFor="cal" className="sr-only">Your answer</label>
          <input id="cal" autoFocus value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off"
            className="h-12 min-w-0 flex-1 rounded-[14px] border-2 border-line bg-white px-4 font-mono text-lg focus:border-violet focus:outline-none"
            placeholder={problem.verifier === 'linearEquation' ? 'x = …' : 'your answer'} />
          <Button type="submit" disabled={!value.trim()}>Submit</Button>
        </form>
        <p className="mt-2 min-h-6 font-hand text-[22px] text-mint-ink" role="status">{msg}</p>
        <div className="mt-2 flex justify-between">
          <Button variant="ghost" size="sm" onClick={() => advance('unsure')}>I&apos;m not sure</Button>
          <Button variant="ghost" size="sm" onClick={() => void finish(results)}>Skip warm-up</Button>
        </div>
      </motion.div>
    </div>
  );
}

export default function CalibratePage() {
  return <AuthGuard><Calibrate /></AuthGuard>;
}
