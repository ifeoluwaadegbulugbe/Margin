'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Atom, BookA, Calculator, Code2 } from 'lucide-react';
import { AuthGuard } from '@/components/layout/AppShell';
import { useProfile } from '@/stores/profile';
import { Button, Label, cx } from '@/components/ui';
import { DevicePanel } from '@/components/learn/DevicePanel';
import { Scribble, Wordmark } from '@/components/notebook/Scribble';
import { Underline } from '@/components/notebook/Annotations';
import { CONSTELLATION } from '@/content';
import type { Tone, YearGroup } from '@/types/domain';

const YEARS: { v: YearGroup; label: string; sub: string }[] = [
  { v: 7, label: 'Year 7', sub: 'age 11–12' }, { v: 8, label: 'Year 8', sub: 'age 12–13' }, { v: 9, label: 'Year 9', sub: 'age 13–14' },
  { v: 10, label: 'Year 10', sub: 'age 14–15' }, { v: 11, label: 'Year 11', sub: 'age 15–16' }, { v: 12, label: 'Year 12', sub: 'age 16–17' },
  { v: 13, label: 'Year 13', sub: 'age 17–18' }, { v: 'adult', label: 'University / adult', sub: 'brushing up' },
];
const SUBJECTS = [
  { id: 'maths', name: 'Mathematics', icon: Calculator, bg: 'bg-lavender', fg: 'text-violet-ink', live: true },
  { id: 'science', name: 'Science', icon: Atom, bg: 'bg-pale-mint', fg: 'text-mint-ink', live: false },
  { id: 'language', name: 'Language', icon: BookA, bg: 'bg-pale-sun', fg: 'text-sun-ink', live: false },
  { id: 'computing', name: 'Computing', icon: Code2, bg: 'bg-pale-blue', fg: 'text-sky-ink', live: false },
];
const STEPS = 5;

function Choice({ selected, onClick, children, className, disabled }: { selected: boolean; onClick?: () => void; children: React.ReactNode; className?: string; disabled?: boolean }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onClick} disabled={disabled}
      className={cx('rounded-[16px] border-2 bg-white p-4 text-left transition-all', selected ? 'border-violet shadow-[0_3px_0_var(--violet)]' : 'border-line hover:border-violet/40', disabled && 'opacity-55', className)}>
      {children}
    </button>
  );
}

function Onboarding() {
  const router = useRouter();
  const { user, ensureUser, update } = useProfile();
  const [step, setStep] = useState(0);
  const [year, setYear] = useState<YearGroup>(10);
  const [goal, setGoal] = useState<1 | 2 | 3>(2);
  const [tone, setTone] = useState<Tone>('encouraging');

  useEffect(() => {
    void ensureUser().then((u) => {
      setStep(Math.min(u.onboardingStep, STEPS - 1));
      setYear(u.yearGroup);
      setGoal(u.dailyGoal);
      setTone(u.tone);
    });
  }, [ensureUser]);

  if (!user) return null;

  const next = async (patch: Parameters<typeof update>[0] = {}) => {
    const s = step + 1;
    await update({ ...patch, onboardingStep: Math.max(user.onboardingStep, s) });
    setStep(s);
  };
  const mood = (['curious', 'curious', 'thinking', 'encouraging', 'excited'] as const)[step];

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-6">
      <div className="flex items-center justify-between">
        <Wordmark />
        <span className="text-sm text-muted tabular">Page {step + 1} of {STEPS}</span>
      </div>
      <div className="mt-4 flex gap-1.5" aria-hidden>{Array.from({ length: STEPS }).map((_, i) => <span key={i} className={cx('h-1.5 flex-1 rounded-full', i <= step ? 'bg-violet' : 'bg-line')} />)}</div>

      <div className="flex flex-1 flex-col justify-center py-8">
        <div className="paper-margin paper-ruled relative rounded-[24px] border border-line px-6 py-8 pl-16 shadow-[var(--shadow-floating)] sm:px-10 sm:pl-20">
          <div className="absolute -top-10 right-6"><Scribble mood={mood} size={76} /></div>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.28 }}>
              {step === 0 && (
                <div>
                  <h1 className="font-display text-[34px] font-extrabold leading-10">Welcome to your <span className="relative inline-block">learning space<Underline className="absolute -bottom-2 left-0 h-3 w-full" delay={0.3} /></span></h1>
                  <p className="mt-4 text-lg text-ink-2">This is your notebook. You do the thinking here, and I&apos;m Scribble: I&apos;ll ask good questions, never hand you answers, and cheer when you figure things out.</p>
                  <p className="mt-3 font-hand text-[24px] text-coral-ink">Let&apos;s set it up together. It takes a minute.</p>
                  <div className="mt-8"><Button size="lg" onClick={() => next()}>Let&apos;s go</Button></div>
                </div>
              )}
              {step === 1 && (
                <div>
                  <h1 className="font-display text-[30px] font-extrabold leading-9">What do you want to explore?</h1>
                  <p className="mt-2 text-ink-2">Mathematics is open today. More subjects are on the way.</p>
                  <div className="mt-6 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Subjects">
                    {SUBJECTS.map(({ id, name, icon: Icon, bg, fg, live }) => (
                      <Choice key={id} selected={live} disabled={!live}>
                        <span className={cx('flex h-11 w-11 items-center justify-center rounded-[12px]', bg)}><Icon className={cx('h-6 w-6', fg)} aria-hidden /></span>
                        <span className="mt-3 block font-semibold">{name}</span>
                        <span className="text-sm text-muted">{live ? CONSTELLATION.name : 'Coming soon'}</span>
                      </Choice>
                    ))}
                  </div>
                  <div className="mt-8"><Button onClick={() => next({ activeConstellation: CONSTELLATION.id })}>Continue</Button></div>
                </div>
              )}
              {step === 2 && (
                <div>
                  <h1 className="font-display text-[30px] font-extrabold leading-9">Where are you right now?</h1>
                  <p className="mt-2 text-ink-2">So I can pitch my questions at the right level. You can change this any time.</p>
                  <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="radiogroup" aria-label="Learning level">
                    {YEARS.map((y) => (
                      <Choice key={String(y.v)} selected={year === y.v} onClick={() => setYear(y.v)} className="p-3">
                        <span className="block font-semibold leading-5">{y.label}</span><span className="text-xs text-muted">{y.sub}</span>
                      </Choice>
                    ))}
                  </div>
                  <div className="mt-8"><Button onClick={() => next({ yearGroup: year })}>Continue</Button></div>
                </div>
              )}
              {step === 3 && (
                <div>
                  <h1 className="font-display text-[30px] font-extrabold leading-9">Set a learning goal</h1>
                  <Label className="mt-6 mb-2">Challenges a day</Label>
                  <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Daily goal">
                    {([1, 2, 3] as const).map((g) => (
                      <Choice key={g} selected={goal === g} onClick={() => setGoal(g)} className="text-center">
                        <span className="block font-display text-[28px] font-extrabold">{g}</span>
                        <span className="text-sm text-muted">{g === 1 ? 'Easy going' : g === 2 ? 'Steady' : 'Ambitious'}</span>
                      </Choice>
                    ))}
                  </div>
                  <Label className="mt-6 mb-2">How should I talk to you?</Label>
                  <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Tone">
                    <Choice selected={tone === 'encouraging'} onClick={() => setTone('encouraging')}><span className="font-semibold">Encouraging</span><span className="block text-sm text-muted">Warm and cheerful</span></Choice>
                    <Choice selected={tone === 'direct'} onClick={() => setTone('direct')}><span className="font-semibold">Direct</span><span className="block text-sm text-muted">Short and to the point</span></Choice>
                  </div>
                  <div className="mt-8"><Button onClick={() => next({ dailyGoal: goal, tone })}>Continue</Button></div>
                </div>
              )}
              {step === 4 && (
                <div>
                  <h1 className="font-display text-[30px] font-extrabold leading-9">Wake me up on this device</h1>
                  <p className="mt-2 mb-5 text-ink-2">I can think privately on your own computer. The first download can take a few minutes, and you can start while it runs.</p>
                  <DevicePanel />
                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Button size="lg" onClick={async () => { await update({ onboardingStep: 5 }); router.push('/calibrate/'); }}>Begin my first challenge</Button>
                    <span className="font-hand text-xl text-muted">a quick warm-up first!</span>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        {step > 0 && <button className="mt-4 self-start text-sm font-medium text-muted hover:text-ink" onClick={() => setStep(step - 1)}>← Back</button>}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return <AuthGuard requireOnboarded={false}><Onboarding /></AuthGuard>;
}
