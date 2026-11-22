'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BookOpen, Compass, Gift, Home, LineChart, LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { useProfile } from '@/stores/profile';
import { cx, Spinner } from '@/components/ui';
import { XpPill } from '@/components/game';
import { Wordmark, MarginMark } from '@/components/notebook/Scribble';

const NAV = [
  { href: '/desk/', label: 'Home', icon: Home },
  { href: '/notebook/', label: 'My notebook', icon: BookOpen },
  { href: '/explore/', label: 'Explore', icon: Compass },
  { href: '/rewards/', label: 'Rewards', icon: Gift },
  { href: '/progress/', label: 'Progress', icon: LineChart },
];

/** Client-side route guard: unauthenticated -> landing; un-onboarded -> onboarding. */
export function AuthGuard({ children, requireOnboarded = true }: { children: ReactNode; requireOnboarded?: boolean }) {
  const status = useAuth((s) => s.status);
  const loaded = useProfile((s) => s.loaded);
  const user = useProfile((s) => s.user);
  const router = useRouter();
  useEffect(() => {
    if (status === 'signedOut') router.replace('/');
    else if (status === 'signedIn' && loaded && requireOnboarded && (!user || user.onboardingStep < 4)) router.replace('/onboarding/');
  }, [status, loaded, user, requireOnboarded, router]);
  if (status !== 'signedIn' || !loaded || (requireOnboarded && (!user || user.onboardingStep < 4))) {
    return <div className="flex min-h-dvh items-center justify-center"><Spinner /></div>;
  }
  return <>{children}</>;
}

function ProfileMenu() {
  const user = useProfile((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const initial = (user?.displayName ?? 'You').charAt(0).toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label="Profile menu"
        className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-coral font-display font-bold text-white shadow-[var(--shadow-card)]">
        {initial}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-40 w-56 rounded-[16px] border border-line bg-white p-1.5 shadow-[var(--shadow-floating)]">
          <div className="px-3 py-2 text-sm"><div className="font-semibold">{user?.displayName ?? 'Guest learner'}</div><div className="text-muted">{user?.isAnonymous ? 'Guest account' : 'Signed in'}</div></div>
          <Link role="menuitem" href="/settings/" onClick={() => setOpen(false)} className="flex h-10 items-center gap-2.5 rounded-[10px] px-3 text-sm hover:bg-warm"><Settings className="h-4 w-4 text-muted" />Settings &amp; AI engine</Link>
          <button role="menuitem" onClick={async () => { await signOut(); router.replace('/'); }} className="flex h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-sm hover:bg-warm"><LogOut className="h-4 w-4 text-muted" />Sign out</button>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const path = usePathname();
  const isActive = (href: string) => path?.startsWith(href.replace(/\/$/, ''));
  return (
    <AuthGuard>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-[88px] shrink-0 flex-col border-r border-line bg-paper py-6 md:flex xl:w-[232px]">
          <Link href="/desk/" className="mb-10 flex justify-center px-5 xl:justify-start" aria-label="Margin home">
            <span className="xl:hidden"><MarginMark size={34} /></span>
            <Wordmark className="hidden xl:inline-flex" />
          </Link>
          <nav className="flex flex-col gap-1 px-3" aria-label="Main">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link key={href} href={href} aria-current={active ? 'page' : undefined} title={label}
                  className={cx('group flex h-12 items-center justify-center gap-3 rounded-[14px] px-3 text-[15px] font-medium transition-colors xl:justify-start',
                    active ? 'bg-white text-ink shadow-[var(--shadow-card)]' : 'text-ink-2 hover:bg-white/70')}>
                  <Icon className={cx('h-5 w-5 shrink-0', active ? 'text-violet' : 'text-muted group-hover:text-ink')} aria-hidden />
                  <span className={cx('hidden xl:inline', active && 'marker marker-violet')}>{label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto hidden px-6 font-hand text-xl leading-6 text-muted xl:block">Think it through.</div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line/70 bg-paper/90 px-4 py-3 backdrop-blur sm:px-6">
            <Link href="/desk/" className="md:hidden" aria-label="Margin home"><Wordmark /></Link>
            <div className="hidden md:block" />
            <div className="flex items-center gap-3"><XpPill compact={false} /><ProfileMenu /></div>
          </header>
          <main className={cx('mx-auto w-full flex-1 px-4 py-6 sm:px-6 md:py-8', wide ? 'max-w-[1360px]' : 'max-w-[1160px]')}>{children}</main>
        </div>
        <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-white/95 backdrop-blur md:hidden" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={cx('flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium', active ? 'text-violet-ink' : 'text-muted')}>
                <span className={cx('flex h-7 w-12 items-center justify-center rounded-full', active && 'bg-lavender')}><Icon className="h-5 w-5" aria-hidden /></span>
                {label === 'My notebook' ? 'Notebook' : label}
              </Link>
            );
          })}
        </nav>
      </div>
    </AuthGuard>
  );
}
