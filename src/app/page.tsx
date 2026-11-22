'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { Lock, MessageCircleQuestion, PenLine } from 'lucide-react';
import { useAuth, isFirebaseConfigured } from '@/stores/auth';
import { useProfile } from '@/stores/profile';
import { Button, NoteCard, cx } from '@/components/ui';
import { Scribble, Wordmark } from '@/components/notebook/Scribble';
import { Arrow, CheckDoodle, StarDoodle, Tape, Underline } from '@/components/notebook/Annotations';
import { MathText } from '@/components/learn/Math';

/** Illustrated open notebook with floating notes that drift subtly on scroll. */
function HeroNotebook() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y1 = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -60]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 40]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -30]);
  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[560px] py-8" aria-hidden>
      {/* notebook spread */}
      <div className="relative grid grid-cols-2 rounded-[24px] border border-line bg-white shadow-[var(--shadow-floating)]" style={{ transform: 'rotate(-1.5deg)' }}>
        <div className="paper-ruled paper-margin min-h-[300px] rounded-l-[24px] border-r border-line p-5 pl-14">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Algebra · page 2</div>
          <div className="relative mt-6 inline-block text-[26px] sm:text-[30px]">
            <span className="marker"><MathText latex="3x + 5 = 20" /></span>
          </div>
          <div className="mt-6 font-mono text-[15px] text-ink-2">3x = 15 <CheckDoodle className="inline h-5 w-5" /></div>
          <div className="relative mt-5 font-hand text-[22px] text-coral-ink">Try this first!</div>
          <Arrow className="absolute left-24 top-[118px] h-12 w-16 rotate-[200deg]" delay={0.6} />
        </div>
        <div className="paper-grid min-h-[300px] rounded-r-[24px] p-5">
          <div className="flex items-start gap-2">
            <Scribble mood="curious" size={52} />
            <NoteCard tone="white" className="mt-2 p-3 text-[14px] leading-5">What&apos;s being <span className="marker">added</span> to the 3x?</NoteCard>
          </div>
          <NoteCard tone="sun" tilt={2} className="mt-6 p-3 text-[13px] leading-5">
            <Tape className="absolute -top-2 left-1/2 -translate-x-1/2 rotate-[-4deg]" />
            <span className="font-hand text-[20px]">Hint 1</span><br />Undo the +5 on <em>both</em> sides.
          </NoteCard>
        </div>
        {/* spiral binding */}
        <div className="absolute left-1/2 top-6 bottom-6 flex -translate-x-1/2 flex-col justify-between">
          {Array.from({ length: 8 }).map((_, i) => <span key={i} className="h-3 w-5 rounded-full border-2 border-ink/40 bg-paper" />)}
        </div>
      </div>
      {/* floating notes */}
      <motion.div style={{ y: y1 }} className="absolute -left-3 top-0 sm:-left-10">
        <NoteCard tone="lavender" tilt={-8} className="float-slow px-3 py-2 font-hand text-[24px] text-violet-ink">x = ?</NoteCard>
      </motion.div>
      <motion.div style={{ y: y2 }} className="absolute -right-2 top-4 sm:-right-8">
        <div className="float-slow" style={{ ['--r' as string]: '12deg' }}><StarDoodle className="h-12 w-12" /></div>
      </motion.div>
      <motion.div style={{ y: y3 }} className="absolute -bottom-2 right-6">
        <NoteCard tone="mint" tilt={6} className="px-3 py-2 font-hand text-[22px] text-mint-ink">½ + ¼ = ¾</NoteCard>
      </motion.div>
    </div>
  );
}

/** Tiny interactive challenge preview (no AI, no sign-in). */
function TryIt() {
  const [pick, setPick] = useState<string | null>(null);
  const options = [
    { id: 'sub', text: 'Subtract 5 from both sides', good: true, note: 'Yes! Undo the +5 first, and keep both sides balanced.' },
    { id: 'div', text: 'Divide by 3 first', good: false, note: 'That works too, but now you have 5/3 to deal with. Is there a tidier first move?' },
    { id: 'add', text: 'Add 5 to both sides', good: false, note: 'Hmm, adding 5 makes the left side 3x + 10. What would undo +5 instead?' },
  ];
  const chosen = options.find((o) => o.id === pick);
  return (
    <div className="rounded-[24px] border border-line bg-white p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <Scribble mood={chosen ? (chosen.good ? 'excited' : 'encouraging') : 'curious'} size={52} />
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Try it now</div>
          <div className="font-display text-xl font-bold">For <MathText latex="3x + 5 = 20" />, what would you do first?</div>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <button key={o.id} onClick={() => setPick(o.id)} aria-pressed={pick === o.id}
            className={cx('rounded-[14px] border px-4 py-3 text-left text-[15px] font-medium transition-all',
              pick === o.id ? (o.good ? 'border-mint bg-pale-mint' : 'border-coral/60 bg-pale-coral') : 'border-line bg-paper hover:border-violet/50')}>
            {o.text}
          </button>
        ))}
      </div>
      <div className="min-h-[56px]" aria-live="polite">
        {chosen && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 font-hand text-[24px] leading-7 text-ink">{chosen.note}</motion.p>
        )}
      </div>
    </div>
  );
}

export default function Landing() {
  const router = useRouter();
  const { status, signInGuest, signInGoogle, error } = useAuth();
  const user = useProfile((s) => s.user);
  const loaded = useProfile((s) => s.loaded);
  const [busy, setBusy] = useState<'guest' | 'google' | null>(null);

  useEffect(() => {
    if (status === 'signedIn' && loaded) router.replace(user && user.onboardingStep >= 4 ? '/desk/' : '/onboarding/');
  }, [status, loaded, user, router]);

  const go = async (kind: 'guest' | 'google') => {
    setBusy(kind);
    try {
      if (kind === 'guest') await signInGuest();
      else await signInGoogle();
    } catch {
      /* error shown from the store */
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-dvh overflow-x-hidden">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
        <header className="flex items-center justify-between py-5">
          <Wordmark />
          <nav className="flex items-center gap-2 text-sm">
            <a href="#how" className="rounded-[10px] px-3 py-2 font-medium text-ink-2 hover:bg-white">How it works</a>
          </nav>
        </header>

        <main className="grid items-center gap-10 py-8 lg:grid-cols-[1.05fr_1fr] lg:py-14">
          <div>
            <span className="inline-flex items-center gap-2 rounded-[8px] bg-lavender px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-violet-ink">An interactive learning notebook</span>
            <h1 className="mt-5 font-display text-[40px] font-extrabold leading-[44px] tracking-tight sm:text-[54px] sm:leading-[58px]">
              Don&apos;t just get the answer.{' '}
              <span className="relative inline-block">
                <span className="relative z-[1]">Discover</span>
                <Underline className="absolute -bottom-2 left-0 z-0 h-4 w-full" delay={0.4} />
              </span>{' '}how to solve it.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-ink-2">Margin helps you think through problems, understand concepts and build confidence, one discovery at a time. Your guide asks the right question. You find the answer.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => go('guest')} loading={busy === 'guest' || status === 'loading'}>Start learning</Button>
              <Button size="lg" variant="secondary" onClick={() => go('google')} loading={busy === 'google'} disabled={!isFirebaseConfigured} title={isFirebaseConfigured ? undefined : 'Needs Firebase configuration'}>Continue with Google</Button>
            </div>
            {error && <p className="mt-3 text-sm text-coral-ink" role="alert">{error}</p>}
            {!isFirebaseConfigured && (
              <p className="mt-4 max-w-lg text-sm text-muted">Local mode: Firebase isn&apos;t configured in this build, so your notebook stays in this browser and Scribble uses its written notes.</p>
            )}
          </div>
          <HeroNotebook />
        </main>

        <section className="py-6"><TryIt /></section>

        <section id="how" className="scroll-mt-6 py-14">
          <h2 className="font-display text-[30px] font-extrabold">How it works</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { icon: PenLine, tone: 'lavender' as const, title: 'You write, line by line', text: 'Work in your notebook. A maths checker looks at every line you write, so you know exactly where things changed.' },
              { icon: MessageCircleQuestion, tone: 'sun' as const, title: 'Scribble asks, you think', text: 'Your guide never hands over the answer. It asks one good question at a time, and hints are there when you need them.' },
              { icon: Lock, tone: 'mint' as const, title: 'Private, and gets to know you', text: 'Scribble runs on your own computer in Chrome. A learning guide in the cloud spots your habits from scores, never from what you type.' },
            ].map(({ icon: Icon, tone, title, text }, i) => (
              <NoteCard key={title} tone={tone} tilt={[-1, 0.8, -0.6][i]} className="p-6">
                <Icon className="h-6 w-6 text-ink" aria-hidden />
                <h3 className="mt-3 font-display text-lg font-bold">{title}</h3>
                <p className="mt-1 text-[15px] text-ink-2">{text}</p>
              </NoteCard>
            ))}
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-6 text-sm text-muted">
          <span>MIT licensed · no ads, no tracking scripts · we store your year group, never your date of birth.</span>
          <span className="font-hand text-xl text-ink-2">Think it through.</span>
        </footer>
      </div>
    </div>
  );
}
