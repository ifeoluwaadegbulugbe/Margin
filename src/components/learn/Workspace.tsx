'use client';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, Flag, Lightbulb, List, Send } from 'lucide-react';
import { getProblem, getSkill, type Problem } from '@/content';
import { useSession, activeProblem, type ChatMessage } from '@/stores/session';
import { useAiStatus } from '@/stores/aiStatus';
import { useProfile } from '@/stores/profile';
import { potentialSolveXp, HINT_MULTIPLIER } from '@/lib/game/xp';
import { displayStreak, localDate } from '@/lib/game/streak';
import type { LineEntry, ProblemState, Stage } from '@/lib/learning/reducer';
import { MISCONCEPTIONS, isMisconceptionId } from '@/content/misconceptions';
import { Button, IconButton, Label, NoteCard, cx } from '@/components/ui';
import { Scribble, type Mood } from '@/components/notebook/Scribble';
import { Arrow, CheckDoodle, CrossDoodle, StarBurst, Tape, Underline } from '@/components/notebook/Annotations';
import { burst } from '@/components/game';
import { SourceChip } from './SourceChip';
import { Statement, MathText } from './Math';
import { InferenceLog } from './InferenceLog';

const STAGES: { key: Stage; label: string; hint: string }[] = [
  { key: 'ORIENT', label: 'Understand', hint: 'What is the question asking?' },
  { key: 'PLAN', label: 'Plan', hint: 'Pick a first move' },
  { key: 'STEP', label: 'Work it out', hint: 'One line at a time' },
  { key: 'VERIFY', label: 'Check', hint: 'Does it work?' },
  { key: 'EXPLAIN', label: 'Explain', hint: 'Why did it work?' },
  { key: 'TRANSFER', label: 'Try it elsewhere', hint: 'Same idea, new place' },
];
const stageIndex = (s: Stage) => (s === 'COMPLETE' ? STAGES.length : STAGES.findIndex((x) => x.key === s));

const HEADINGS: Record<Stage, [string, string]> = {
  ORIENT: ["Let's solve this together.", 'Read it slowly. What is it asking you to find?'],
  PLAN: ["Let's solve this together.", 'Decide your first move before you write.'],
  STEP: ['Keep going, line by line.', 'Each line should keep both sides balanced.'],
  VERIFY: ['Nearly there: check it.', 'Put your answer in the box when you are sure.'],
  EXPLAIN: ['You found it! Now explain it.', 'Tell Scribble, in one sentence, why your method works.'],
  TRANSFER: ['Same idea, new situation.', 'Hints are tucked away. Try it on your own first.'],
  COMPLETE: ['Page complete!', 'That page is yours now.'],
};

/** Highlight key reasoning words and maths fragments in Scribble's notes. */
function Highlighted({ text, animate }: { text: string; animate: boolean }) {
  const re = /(both sides|balanced|balance|undo(?:es)?|opposite|inverse|line \d+|[0-9a-z]*\d[0-9a-z]*\s*[=+\-−×÷/]\s*[0-9a-z−-]+)/gi;
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1
        ? <mark key={i} className={cx('marker bg-transparent text-inherit', animate && 'marker-anim')} style={animate ? { animationDelay: `${180 + i * 60}ms` } : undefined}>{p}</mark>
        : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

function SessionRail({ current, problemIds, index }: { current: ProblemState; problemIds: string[]; index: number }) {
  const idx = stageIndex(current.stage);
  return (
    <nav aria-label="Session" className="space-y-7">
      <div>
        <Label>This session</Label>
        <ol className="mt-3 space-y-1.5">
          {problemIds.map((id, i) => {
            const p = getProblem(id);
            const state = i < index ? 'done' : i === index ? 'current' : 'next';
            return (
              <li key={id} className={cx('flex items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-sm', state === 'current' && 'bg-white shadow-[var(--shadow-card)]')}>
                <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  state === 'done' ? 'bg-pale-mint text-mint-ink' : state === 'current' ? 'bg-violet text-white' : 'bg-warm text-muted')}>{state === 'done' ? '✓' : i + 1}</span>
                <span className={cx('min-w-0 truncate', state === 'next' ? 'text-muted' : 'text-ink')}>{p?.latex ? <MathText latex={p.latex} /> : p?.statement.slice(0, 24) + '…'}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <div>
        <Label>Steps</Label>
        <ol className="relative mt-3 space-y-3 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:border-l-2 before:border-dashed before:border-line">
          {STAGES.map((s, i) => {
            const done = i < idx;
            const cur = i === idx;
            return (
              <li key={s.key} className="relative flex items-start gap-3" aria-current={cur ? 'step' : undefined}>
                <span className={cx('relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-paper',
                  done ? 'border-mint' : cur ? 'border-violet bg-lavender' : 'border-line')}>
                  {done ? <CheckDoodle className="h-4 w-4" width={3.5} /> : cur ? <span className="h-2 w-2 rounded-full bg-violet" /> : null}
                </span>
                <span className="leading-5">
                  <span className={cx('block text-sm font-semibold', cur ? 'text-violet-ink' : done ? 'text-ink' : 'text-muted')}>{s.label}</span>
                  {cur && <span className="font-hand text-[18px] text-ink-2">{s.hint}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

function StageStrip({ stage }: { stage: Stage }) {
  const idx = stageIndex(stage);
  return (
    <ol className="flex gap-1.5 xl:hidden" aria-label="Steps">
      {STAGES.map((s, i) => (
        <li key={s.key} className="flex-1" aria-current={i === idx ? 'step' : undefined} title={s.label}>
          <span className={cx('block h-1.5 rounded-full', i < idx ? 'bg-mint' : i === idx ? 'bg-violet' : 'bg-line')} />
          <span className={cx('mt-1 hidden text-[11px] font-semibold sm:block', i === idx ? 'text-violet-ink' : 'text-muted')}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

function LineRow({ n, entry, isLast }: { n: number; entry: LineEntry; isLast: boolean }) {
  const reduce = useReducedMotion();
  const st = entry.result.status;
  const misc = entry.result.misconception && isMisconceptionId(entry.result.misconception) ? MISCONCEPTIONS[entry.result.misconception].name : null;
  const discovery = isLast && st === 'balanced' && !entry.superseded;
  return (
    <motion.li
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={reduce ? { opacity: 1 } : st === 'changed' && isLast ? { opacity: 1, y: 0, x: [0, -4, 4, -4, 0] } : { opacity: 1, y: 0 }}
      transition={{ duration: st === 'changed' ? 0.18 : 0.2 }}
      className="relative min-h-[40px] py-1.5"
    >
      <div className="flex items-start gap-3">
        <span className="absolute -left-10 top-[9px] w-6 text-right font-hand text-[18px] text-coral-ink/70 tabular">{n}</span>
        <span className={cx('relative min-w-0 flex-1 break-words font-mono text-[19px] leading-7',
          st === 'unreadable' && 'text-muted', entry.superseded && 'text-muted line-through decoration-coral decoration-2')}>
          {st === 'changed' && !entry.superseded ? <span className="relative inline-block px-1">{entry.text}<svg className="pointer-events-none absolute -inset-x-2 -inset-y-1.5 h-[calc(100%+12px)] w-[calc(100%+16px)]" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden><path d="M12 6 C 40 0, 90 2, 96 18 C 100 34, 60 39, 40 38 C 10 37, 2 28, 4 18 C 6 8, 30 3, 50 3" fill="none" stroke="var(--coral)" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg></span> : entry.text}
        </span>
        <span className="relative mt-1 flex shrink-0 items-center gap-1 text-xs font-semibold">
          {st === 'balanced' && !entry.superseded && <><CheckDoodle className="h-6 w-6" /><span className="sr-only">Balanced</span></>}
          {st === 'no_progress' && <span className="rounded-[6px] bg-pale-sun px-1.5 py-0.5 text-sun-ink">true, not simpler</span>}
          {st === 'changed' && !entry.superseded && <><CrossDoodle className="h-5 w-5" /><span className="sr-only">Solution changed</span></>}
          {entry.superseded && <span className="font-hand text-[17px] font-normal text-mint-ink">fixed it!</span>}
          {st === 'unreadable' && <span className="text-muted">couldn&apos;t read</span>}
          {discovery && <StarBurst show />}
          {discovery && !reduce && <motion.span className="absolute -top-3 right-0 font-display text-sm font-bold text-sun-ink" initial={{ y: 0, opacity: 1 }} animate={{ y: -18, opacity: 0 }} transition={{ duration: 0.9 }}>+10 XP</motion.span>}
        </span>
      </div>
      {!entry.superseded && (st !== 'balanced' || isLast) && (
        <p className={cx('mt-0.5 font-hand text-[20px] leading-6', st === 'changed' ? 'text-coral-ink' : st === 'balanced' ? 'text-mint-ink' : 'text-ink-2')}>
          {entry.result.message}{misc && st === 'changed' ? <span className="text-ink-2"> · maybe: {misc.toLowerCase()}?</span> : null}
        </p>
      )}
    </motion.li>
  );
}

const KEYS = ['x', '=', '+', '−', '×', '/', '(', ')'];

function LineInput({ disabled, onSubmit, placeholder, n }: { disabled: boolean; onSubmit: (t: string) => Promise<unknown>; placeholder: string; n: number }) {
  const [v, setV] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const submit = async () => {
    const t = v.trim();
    if (!t) return;
    setV('');
    await onSubmit(t);
    ref.current?.focus();
  };
  const insert = (k: string) => {
    const el = ref.current;
    const ch = k === '−' ? '-' : k === '×' ? '*' : k;
    if (!el) return setV((s) => s + ch);
    const s = el.selectionStart ?? v.length;
    const e = el.selectionEnd ?? v.length;
    setV(v.slice(0, s) + ch + v.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + ch.length, s + ch.length); });
  };
  return (
    <div>
      <div className="relative flex items-center gap-2">
        <span className="absolute -left-10 w-6 text-right font-hand text-[18px] text-coral-ink/50 tabular" aria-hidden>{n}</span>
        <label className="sr-only" htmlFor="line-input">Next line of working</label>
        <input
          id="line-input" ref={ref} value={v} disabled={disabled} onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submit(); } }}
          placeholder={placeholder} autoComplete="off" spellCheck={false}
          className="h-12 min-w-0 flex-1 rounded-[12px] border-2 border-dashed border-violet/35 bg-white/70 px-3 font-mono text-[19px] text-ink placeholder:font-hand placeholder:text-[22px] placeholder:text-muted focus:border-solid focus:border-violet focus:bg-white focus:outline-none disabled:opacity-50"
        />
        <Button onClick={() => void submit()} disabled={disabled || !v.trim()} className="h-12">Check line</Button>
      </div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto md:hidden" aria-label="Maths keys">
        {KEYS.map((k) => (
          <button key={k} type="button" onClick={() => insert(k)} disabled={disabled} className="h-11 min-w-11 rounded-[10px] border border-line bg-white font-mono text-lg text-ink shadow-[var(--shadow-card)]">{k}</button>
        ))}
      </div>
    </div>
  );
}

function FinalAnswer({ problem, disabled, onSubmit, feedback }: { problem: Problem; disabled: boolean; onSubmit: (t: string) => Promise<void>; feedback: ReturnType<typeof useSession.getState>['finalFeedback'] }) {
  const [v, setV] = useState('');
  const isEq = problem.verifier === 'linearEquation';
  return (
    <div className="rounded-[16px] border-2 border-line bg-white p-3.5">
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (v.trim()) void onSubmit(v); }}>
        <label htmlFor="final" className="shrink-0 font-semibold text-ink">I&apos;m done:{isEq ? <span className="ml-1.5 font-mono">{problem.variable ?? 'x'} =</span> : <span className="ml-1.5">the answer is</span>}</label>
        <input id="final" value={v} onChange={(e) => setV(e.target.value)} disabled={disabled} autoComplete="off" spellCheck={false}
          className="h-11 w-28 min-w-0 flex-1 rounded-[10px] border-b-2 border-violet/40 bg-paper px-3 font-mono text-lg focus:border-violet focus:outline-none disabled:opacity-50 sm:flex-none" placeholder="___" />
        <Button type="submit" variant="secondary" disabled={disabled || !v.trim()}>Check answer</Button>
      </form>
      {feedback && (
        <p className={cx('mt-2 font-hand text-[22px] leading-6', feedback.kind === 'correct' ? 'text-mint-ink' : feedback.kind === 'simplify' ? 'text-sun-ink' : 'text-coral-ink')} role="status">{feedback.text}</p>
      )}
    </div>
  );
}

const RUNG_NAMES = ['Small clue', 'Margin note', 'Next move', 'Worked example'];

/** Hints appear ON the page as notes, each rung a different kind of paper. */
function HintNote({ m }: { m: ChatMessage }) {
  const [step, setStep] = useState(1);
  const level = m.hint!.level;
  const worked = m.hint!.worked;
  const reduce = useReducedMotion();
  const enter = reduce ? { initial: { opacity: 0 }, animate: { opacity: 1 } } : { initial: { opacity: 0, y: 14, rotate: level === 3 ? -2 : 1 }, animate: { opacity: 1, y: 0, rotate: level === 3 ? -1 : level === 4 ? 0.5 : 0 } };
  const header = <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Hint {level} · {RUNG_NAMES[level - 1]}</span><SourceChip source={m.source ?? null} latencyMs={m.latencyMs} /></div>;
  if (level === 2) {
    return (
      <motion.div {...enter} className="relative pl-14">
        <Arrow className="absolute left-0 top-0 h-10 w-12 -scale-y-100" color="var(--violet)" />
        {header}
        <p className="mt-1 font-hand text-[25px] leading-7 text-violet-ink">{m.text}</p>
      </motion.div>
    );
  }
  return (
    <motion.div {...enter}>
      <NoteCard tone={level === 1 ? 'sun' : level === 3 ? 'lavender' : 'white'} className={cx(level === 4 && 'pt-5')}>
        {level === 4 && <Tape className="absolute -top-2 left-1/2 -translate-x-1/2 rotate-[-3deg]" />}
        {header}
        <p className="mt-1.5 text-[16px] leading-6 text-ink">{level === 1 ? <span className="marker">{m.text}</span> : m.text}</p>
        {worked && (
          <div className="paper-grid mt-3 rounded-[10px] border border-line p-3 font-mono text-[16px]">
            {worked.lines.slice(0, step).map((l, i) => <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="leading-8">{i === 0 ? '' : '→ '}{l}</motion.div>)}
            {step < worked.lines.length
              ? <button className="mt-1 font-sans text-sm font-semibold text-violet-ink" onClick={() => setStep((s) => s + 1)}>Show next line</button>
              : <div className="pt-1 font-hand text-[20px] text-ink-2">Now try yours the same way.</div>}
          </div>
        )}
      </NoteCard>
    </motion.div>
  );
}

function scribbleMood(pending: boolean, current: ProblemState, last?: ChatMessage): Mood {
  if (pending) return 'thinking';
  if (current.stage === 'COMPLETE') return 'celebrating';
  if (current.stage === 'EXPLAIN') return 'excited';
  const l = current.lines.at(-1);
  if (l?.result.status === 'changed' && !l.superseded) return 'encouraging';
  if (l?.result.status === 'balanced') return 'excited';
  return last ? 'curious' : 'curious';
}

function ScribblePanel({ mobileOpen, setMobileOpen }: { mobileOpen: boolean; setMobileOpen: (v: boolean) => void }) {
  const { messages, pending, current, reply, flagMessage, offerParallel, takeFreeParallel, offerWorked, requestHint } = useSession();
  const user = useProfile((s) => s.user);
  const [text, setText] = useState('');
  const [slow, setSlow] = useState(false);
  const [showOlder, setShowOlder] = useState(false);
  const [factsFor, setFactsFor] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const notes = messages.filter((m) => !m.hint);
  const lastNova = [...notes].reverse().find((m) => m.from === 'nova');
  const lastIdx = lastNova ? notes.indexOf(lastNova) : -1;
  const older = notes.slice(0, Math.max(0, lastIdx));
  const after = notes.slice(lastIdx + 1); // student replies after the latest note
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages.length, pending]);
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setSlow(true), 2000);
    return () => { clearTimeout(t); setSlow(false); };
  }, [pending]);
  if (!current) return null;
  const stage = current.stage;
  const canReply = stage !== 'COMPLETE' && stage !== 'TRANSFER';
  const mood = scribbleMood(pending, current, lastNova);
  const streak = user ? displayStreak(user.streak, localDate()).count : 0;

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    await reply(t);
  };

  const noteBody = (m: ChatMessage, latest: boolean): ReactNode => (
    <>
      <p className={cx(latest ? 'text-[17px] leading-[27px]' : 'text-[15px] leading-6 text-ink-2')}>
        {latest ? <Highlighted text={m.text} animate /> : m.text}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <SourceChip source={m.source ?? null} latencyMs={m.latencyMs} />
        {m.source && m.source !== 'AUTHORED' && (
          <button onClick={() => { flagMessage(m.id); setFactsFor(m.id); }} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
            <Flag className="h-3 w-3" aria-hidden />{m.flagged ? 'Reported' : 'This seems wrong'}
          </button>
        )}
      </div>
      {factsFor === m.id && (
        <div className="mt-2 rounded-[10px] bg-warm p-3 text-sm text-ink-2">
          <div className="font-semibold text-ink">What the maths checker says</div>
          {m.facts?.length ? <ul className="mt-1 list-disc space-y-0.5 pl-4">{m.facts.map((f, i) => <li key={i}>{f}</li>)}</ul> : <p>No line facts for this note.</p>}
          <p className="mt-1 text-muted">The ticks and crosses on your page always come from the checker, never from Scribble.</p>
        </div>
      )}
    </>
  );

  return (
    <section aria-label="Scribble, your guide" className="flex h-full min-h-0 flex-col">
      <button className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5 lg:cursor-default lg:border-0 lg:pt-5" onClick={() => setMobileOpen(!mobileOpen)} aria-expanded={mobileOpen}>
        <span className="flex items-center gap-3">
          <Scribble mood={mood} size={mobileOpen ? 52 : 40} className="lg:h-[64px] lg:w-[64px]" />
          <span className="text-left">
            <span className="block font-display text-lg font-bold leading-6">Scribble</span>
            <span className="block font-hand text-[18px] leading-5 text-muted">{pending ? (slow ? 'still thinking…' : 'thinking…') : mood === 'encouraging' ? "let's look closer" : mood === 'excited' ? 'nice!' : mood === 'celebrating' ? 'you did it!' : 'your guide'}</span>
          </span>
        </span>
        <span className="text-muted lg:hidden">{mobileOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}</span>
      </button>
      {!mobileOpen && lastNova && <p className="line-clamp-2 px-4 py-2 text-[15px] text-ink-2 lg:hidden">{lastNova.text}</p>}

      <div className={cx('min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4 pt-2', !mobileOpen && 'hidden lg:block')} aria-live="polite">
        {older.length > 0 && (
          <button className="text-sm font-medium text-muted hover:text-ink" onClick={() => setShowOlder(!showOlder)}>{showOlder ? 'Hide' : 'Show'} earlier notes ({older.length})</button>
        )}
        {showOlder && older.map((m) => m.from === 'nova'
          ? <NoteCard key={m.id} tone="white" className="p-3 opacity-80 shadow-none">{noteBody(m, false)}</NoteCard>
          : <p key={m.id} className="pl-3 font-hand text-[20px] leading-6 text-violet-ink">you: {m.text}</p>)}
        <AnimatePresence mode="wait" initial={false}>
          {pending ? (
            <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-[14px] border border-dashed border-violet/40 bg-white/60 p-4">
              <div className="shimmer h-3 w-4/5 rounded" /><div className="shimmer mt-2 h-3 w-3/5 rounded" />
            </motion.div>
          ) : lastNova && (
            <motion.div key={lastNova.id} initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.28 }}>
              <NoteCard tone="white" className="p-4 shadow-[var(--shadow-floating)]">
                <Tape className="absolute -top-2 left-6 rotate-[-5deg]" color="rgba(255,120,108,0.35)" />
                {noteBody(lastNova, true)}
              </NoteCard>
            </motion.div>
          )}
        </AnimatePresence>
        {after.map((m) => <p key={m.id} className="pl-3 font-hand text-[20px] leading-6 text-violet-ink">you: {m.text}</p>)}
        {offerParallel && (
          <NoteCard tone="lavender" className="text-sm">
            <p className="mb-2 text-ink">This one&apos;s tough. Want to look at a similar one together? It&apos;s free this once.</p>
            <Button size="sm" variant="secondary" onClick={takeFreeParallel}>Show me a similar one</Button>
          </NoteCard>
        )}
        {offerWorked && !offerParallel && current.hintLevel < 4 && (
          <NoteCard tone="white" className="text-sm">
            <p className="mb-2 text-ink-2">Would a worked example of a similar problem help? It opens the next hint.</p>
            <Button size="sm" variant="secondary" onClick={() => void requestHint()}>Open next hint</Button>
          </NoteCard>
        )}
        <div ref={endRef} />
      </div>

      {canReply && (
        <form className={cx('flex gap-2 border-t border-line p-3', !mobileOpen && 'hidden lg:flex')} onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <label htmlFor="reply" className="sr-only">Answer Scribble</label>
          <input id="reply" value={text} onChange={(e) => setText(e.target.value)} disabled={pending} autoComplete="off"
            placeholder={stage === 'EXPLAIN' ? 'Because…' : 'Answer Scribble…'}
            className="h-11 min-w-0 flex-1 rounded-[12px] border border-line bg-white px-3.5 text-[15px] placeholder:font-hand placeholder:text-[20px] placeholder:text-muted focus:border-violet focus:outline-none" />
          <IconButton label="Send" type="submit" disabled={pending || !text.trim()} className="h-11 w-11 bg-violet text-white hover:bg-violet-ink hover:text-white disabled:opacity-40"><Send className="h-5 w-5" /></IconButton>
        </form>
      )}

      <div className="hidden grid-cols-2 gap-3 border-t border-line p-4 lg:grid">
        <div className="rounded-[14px] bg-pale-sun p-3">
          <Label>This challenge</Label>
          <div className="mt-1 font-display text-[22px] font-extrabold tabular">{current.solved ? '✓' : <>+{potentialSolveXp(current)}</>} <span className="text-sm font-semibold">XP</span></div>
        </div>
        <div className="rounded-[14px] bg-pale-coral p-3">
          <Label>Current streak</Label>
          <div className="mt-1 font-display text-[22px] font-extrabold tabular">{streak} <span className="text-sm font-semibold">day{streak === 1 ? '' : 's'}</span></div>
        </div>
      </div>
    </section>
  );
}

export function Workspace() {
  const router = useRouter();
  const s = useSession();
  const { current, session, index, pending } = s;
  const lastSource = useAiStatus((a) => a.lastSource);
  const lastLatency = useAiStatus((a) => a.lastLatency);
  const appCheckError = useAiStatus((a) => a.lastError);
  const [logOpen, setLogOpen] = useState(false);
  const [mobileNova, setMobileNova] = useState(false);
  const [showTransferHints, setShowTransferHints] = useState(false);

  const problem = activeProblem(s);
  const main = current ? getProblem(current.problemId) : null;
  const inTransfer = current?.stage === 'TRANSFER' && !!current.transfer;
  const lines = inTransfer ? current!.transfer!.lines : current?.lines ?? [];
  const hintLevel = inTransfer ? current!.transfer!.hintLevel : current?.hintLevel ?? 0;
  const workingOpen = (!!current && ['ORIENT', 'PLAN', 'STEP', 'VERIFY'].includes(current.stage)) || inTransfer;
  const hintNotes = useMemo(() => {
    // hints belong to the problem on screen: during the transfer, only hints opened after it started
    const start = inTransfer ? s.messages.findIndex((m) => m.source === 'AUTHORED' && m.text.startsWith('Transfer challenge')) : -1;
    return s.messages.filter((m, i) => m.hint && i > start);
  }, [s.messages, inTransfer]);

  useEffect(() => {
    if (current?.stage === 'EXPLAIN' && current.hintLevel <= 1 && !current.supported && current.solved) void burst(40);
  }, [current?.stage, current?.hintLevel, current?.supported, current?.solved]);

  if (!current || !session || !problem || !main) return null;
  const skill = getSkill(main.skillId);
  const isLastProblem = index + 1 >= session.problemIds.length;
  const stepNo = Math.min(stageIndex(current.stage) + 1, STAGES.length);
  const [heading, sub] = HEADINGS[current.stage];
  const nextMult = hintLevel < 4 ? HINT_MULTIPLIER[hintLevel + 1] : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1480px] items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link href="/desk/" onClick={() => void s.pause()} className="inline-flex items-center gap-1.5 rounded-[10px] px-2 py-1.5 text-sm font-medium text-ink-2 hover:bg-white"><ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">My desk</span></Link>
          <div className="min-w-0 flex-1 truncate text-center text-sm">
            <span className="font-semibold uppercase tracking-[0.06em] text-muted">Algebra · {skill?.name}</span>
            <span className="text-muted"> · challenge {index + 1} of {session.problemIds.length}</span>
          </div>
          <SourceChip source={lastSource} latencyMs={lastLatency} onClick={() => setLogOpen(true)} />
          <IconButton label="AI engine log" onClick={() => setLogOpen(true)}><List className="h-5 w-5" /></IconButton>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1480px] flex-1 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[230px_minmax(0,1fr)_380px]">
        <aside className="hidden border-r border-line px-5 py-7 xl:block">
          <div className="sticky top-[76px]"><SessionRail current={current} problemIds={session.problemIds} index={index} /></div>
        </aside>

        <div className="min-w-0 px-4 py-6 pb-52 sm:px-8 lg:pb-10">
          <div className="mx-auto max-w-[760px] space-y-6">
            <StageStrip stage={current.stage} />
            <div>
              <Label className="text-violet-ink">Step {stepNo} of {STAGES.length}</Label>
              <h1 className="mt-1 font-display text-[30px] font-extrabold leading-9 sm:text-[34px] sm:leading-10">{heading}</h1>
              <p className="mt-1 text-ink-2">{inTransfer ? <>You solved <span className="font-mono">{main.statement}</span>. {sub}</> : problem.verifier === 'linearEquation' && problem.latex ? `Your challenge is to find the value of ${problem.variable ?? 'x'}. ${sub}` : sub}</p>
            </div>

            {appCheckError && (
              <NoteCard tone="coral" className="flex items-start gap-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral-ink" aria-hidden />{appCheckError} Scribble is using its written notes meanwhile.
              </NoteCard>
            )}

            <section aria-label="The problem" className="paper-grid relative rounded-[24px] border border-line p-6 shadow-[var(--shadow-card)] sm:p-8">
              <Label>{inTransfer ? 'The new situation' : 'The problem'}</Label>
              <div className={cx('mt-3', problem.latex ? 'text-[32px] sm:text-[42px]' : 'text-[19px] leading-8')}>
                {problem.latex ? <span className="marker marker-anim inline-block"><Statement latex={problem.latex} statement={problem.statement} /></span> : <Statement statement={problem.statement} />}
              </div>
              {(current.stage === 'ORIENT' || current.stage === 'PLAN') && !inTransfer && (
                <div className="mt-4 flex items-end gap-1 sm:absolute sm:right-8 sm:top-6 sm:mt-0 sm:flex-col sm:items-end">
                  <span className="font-hand text-[26px] leading-7 text-coral-ink">What would you do first?</span>
                  <Arrow className="hidden h-12 w-16 rotate-[100deg] sm:block" delay={0.5} />
                </div>
              )}
            </section>

            {hintNotes.length > 0 && workingOpen && (
              <section aria-label="Hints" className="space-y-4">{hintNotes.map((m) => <HintNote key={m.id} m={m} />)}</section>
            )}

            <section aria-label="Your working area" className="paper-ruled paper-margin rounded-[24px] border border-line px-5 py-5 pl-16 shadow-[var(--shadow-card)] sm:pl-[68px]">
              <div className="mb-2 flex items-center justify-between"><Label>Your working area</Label>{lines.length > 0 && <span className="font-hand text-[18px] text-muted">{lines.filter((l) => l.result.status === 'balanced').length} balanced</span>}</div>
              <ol>
                <AnimatePresence initial={false}>
                  {lines.map((l, i) => <LineRow key={i} n={i + 1} entry={l} isLast={i === lines.length - 1} />)}
                </AnimatePresence>
              </ol>
              {lines.length === 0 && workingOpen && <p className="py-1 font-hand text-[22px] text-muted">Write your reasoning here, one line at a time…</p>}
              {workingOpen && (
                <div className="mt-3">
                  <LineInput n={lines.length + 1} disabled={pending} onSubmit={s.submitLine} placeholder={problem.verifier === 'linearEquation' ? (lines.length ? 'next line…' : 'e.g. 3x = 15') : 'e.g. 4 + 6'} />
                </div>
              )}
            </section>

            {workingOpen && <FinalAnswer key={problem.id} problem={problem} disabled={pending} onSubmit={s.submitFinal} feedback={s.finalFeedback} />}

            {workingOpen && (!inTransfer || showTransferHints) && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-dashed border-line bg-white/60 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-hand text-[22px] text-ink-2">Need a clue?</span>
                  <span className="flex gap-1.5" aria-label={`Hints used: ${hintLevel} of 4`}>
                    {[1, 2, 3, 4].map((r) => <span key={r} title={RUNG_NAMES[r - 1]} className={cx('h-2.5 w-2.5 rounded-full', r <= hintLevel ? 'bg-sunshine' : 'border-2 border-line')} />)}
                  </span>
                </div>
                <Button variant="sun" size="sm" onClick={() => { void s.requestHint(); }} disabled={pending || hintLevel >= 4} icon={<Lightbulb className="h-4 w-4" />}>
                  {hintLevel >= 4 ? 'All hints revealed' : <>Reveal a hint <span className="font-normal opacity-75">(XP ×{nextMult?.toFixed(2)})</span></>}
                </Button>
              </div>
            )}
            {inTransfer && (
              <div className="flex flex-wrap gap-2">
                {!showTransferHints && <Button variant="ghost" size="sm" onClick={() => setShowTransferHints(true)}>Show hints</Button>}
                <Button variant="ghost" size="sm" onClick={() => void s.skipTransfer()}>Skip this one</Button>
              </div>
            )}

            {current.stage === 'EXPLAIN' && (
              <NoteCard tone="mint" className="p-5">
                <div className="font-hand text-[28px] leading-8 text-mint-ink">Correct, and it came from your own working!</div>
                <p className="mt-1 text-ink-2">Now tell Scribble <em>why</em> it works, in one sentence. <span className="lg:hidden">Open Scribble below to reply.</span></p>
                <Button size="sm" variant="secondary" className="mt-3 lg:hidden" onClick={() => setMobileNova(true)}>Answer Scribble</Button>
              </NoteCard>
            )}

            {current.stage === 'COMPLETE' && (
              <div className="relative overflow-hidden rounded-[24px] border border-line bg-white p-6 text-center shadow-[var(--shadow-floating)]">
                <Scribble mood="celebrating" size={84} className="mx-auto" />
                <div className="relative mx-auto mt-2 inline-block font-display text-[30px] font-extrabold">Page complete!<Underline className="absolute -bottom-2 left-0 h-3 w-full" color="var(--mint)" /></div>
                <p className="mt-3 text-ink-2">{current.transfer?.solved ? 'You solved it, explained it and used it somewhere new.' : 'You solved it and explained your thinking.'}</p>
                <Button size="lg" className="mt-5" loading={s.finishing} onClick={async () => {
                  await s.nextProblem();
                  if (isLastProblem) router.push('/complete/');
                }}>{isLastProblem ? 'Finish this chapter' : 'Turn the page →'}</Button>
              </div>
            )}
          </div>
        </div>

        <aside className={cx(
          'fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-[24px] border-t border-line bg-paper shadow-[0_-8px_24px_rgba(40,36,59,0.08)] transition-[height] duration-300',
          mobileNova ? 'h-[78dvh]' : 'h-[136px]',
          'lg:sticky lg:top-[57px] lg:z-0 lg:h-[calc(100dvh-57px)] lg:rounded-none lg:border-l lg:border-t-0 lg:bg-warm/50 lg:shadow-none',
        )}>
          <ScribblePanel mobileOpen={mobileNova} setMobileOpen={setMobileNova} />
        </aside>
      </div>

      <InferenceLog open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  );
}
