'use client';
import { useEffect, type ReactNode } from 'react';
import { WifiOff } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { useProfile } from '@/stores/profile';
import { checkNanoAvailability } from '@/lib/ai/deviceModel';
import { Toaster } from '@/components/ui';
import { useOnline } from '@/hooks/useOnline';
import { useAiStatus, deviceIsSlow } from '@/stores/aiStatus';
import { warmUpDevice } from '@/lib/ai/inference';

export function Providers({ children }: { children: ReactNode }) {
  const init = useAuth((s) => s.init);
  const uid = useAuth((s) => s.uid);
  const status = useAuth((s) => s.status);
  const load = useProfile((s) => s.load);
  const reset = useProfile((s) => s.reset);

  useEffect(() => init(), [init]);
  useEffect(() => {
    // When Nano is already downloaded, load it in the background and measure its speed (skipped if it is
    // already known to be too slow here and auto mode will route live turns to the cloud anyway).
    void checkNanoAvailability().then((d) => {
      const st = useAiStatus.getState();
      if (d === 'available' && (st.deviceMode === 'always' || !deviceIsSlow(st.deviceLatencies))) void warmUpDevice();
    });
  }, []);
  useEffect(() => {
    if (uid) void load(uid);
    else if (status === 'signedOut') reset();
  }, [uid, status, load, reset]);

  return (
    <>
      <OfflineBanner />
      {children}
      <Toaster />
    </>
  );
}

function OfflineBanner() {
  const online = useOnline();
  const device = useAiStatus((s) => s.device);
  if (online) return null;
  return (
    <div className="sticky top-0 z-30 flex items-center justify-center gap-2 border-b border-sunshine/50 bg-pale-sun px-4 py-2 text-center text-sm text-ink" role="status">
      <WifiOff className="h-4 w-4" aria-hidden />
      {device === 'available'
        ? 'Offline. Scribble is running on your device, and your progress will sync later.'
        : 'Offline. Scribble will use its written notes; the maths checker still works.'}
    </div>
  );
}
