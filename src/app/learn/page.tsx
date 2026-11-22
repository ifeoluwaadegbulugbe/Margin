'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/layout/AppShell';
import { Workspace } from '@/components/learn/Workspace';
import { useSession } from '@/stores/session';
import { useProfile } from '@/stores/profile';
import { Spinner } from '@/components/ui';
import type { SessionRecord } from '@/types/domain';

function LearnInner() {
  const router = useRouter();
  const session = useSession((s) => s.session);
  const current = useSession((s) => s.current);
  const completion = useSession((s) => s.completion);
  const resume = useSession((s) => s.resume);
  const sessions = useProfile((s) => s.sessions);

  useEffect(() => {
    if (current && session?.status === 'active') return;
    if (completion) { router.replace('/complete/'); return; }
    // resume an unfinished expedition: local draft first (crash recovery), then the saved session
    let draft: SessionRecord | null = null;
    try {
      const raw = window.localStorage.getItem('margin.draft');
      draft = raw ? (JSON.parse(raw) as SessionRecord) : null;
    } catch {
      draft = null;
    }
    const saved = sessions.find((s) => s.status === 'active' && s.currentState);
    const pick = draft && draft.status === 'active' && (!saved || draft.id === saved.id || (draft.startedAt ?? 0) >= saved.startedAt) ? draft : saved;
    if (pick) resume(pick);
    else router.replace('/desk/');
  }, [current, session, completion, sessions, resume, router]);

  if (!current) return <div className="flex min-h-dvh items-center justify-center"><Spinner /></div>;
  return <Workspace />;
}

export default function LearnPage() {
  return <AuthGuard><LearnInner /></AuthGuard>;
}
