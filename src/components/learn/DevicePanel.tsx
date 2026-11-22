'use client';
import { Cloud, RefreshCw } from 'lucide-react';
import { useAiStatus, deviceIsSlow, medianLatency } from '@/stores/aiStatus';
import { checkNanoAvailability, wakeNova } from '@/lib/ai/deviceModel';
import { isFirebaseConfigured } from '@/lib/firebase/client';
import { Button, NoteCard, Ring } from '@/components/ui';
import { Scribble } from '@/components/notebook/Scribble';

/** Device model status + "Wake Scribble" (a user gesture triggers initializeDeviceModel). */
export function DevicePanel() {
  const device = useAiStatus((s) => s.device);
  const detail = useAiStatus((s) => s.deviceDetail);
  const progress = useAiStatus((s) => s.progress);
  const latencies = useAiStatus((s) => s.deviceLatencies);
  const mode = useAiStatus((s) => s.deviceMode);
  const median = medianLatency(latencies);
  const slow = deviceIsSlow(latencies);

  return (
    <div className="rounded-[18px] border border-line bg-white p-4">
      <div className="flex items-start gap-4">
        <Ring value={device === 'available' ? 1 : device === 'downloading' ? progress : 0} size={68} color="var(--mint)">
          <Scribble size={44} mood={device === 'available' ? 'excited' : device === 'downloading' ? 'thinking' : 'curious'} />
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-bold">Scribble on this device</div>
          <div className="text-sm text-ink-2" role="status">
            Gemini Nano: <span className="font-mono">{device}</span>
            {device === 'downloading' && <> · <span className="tabular">{Math.round(progress * 100)}%</span> (carry on, the cloud covers the gap)</>}
          </div>
          {device === 'available' && <p className="mt-1 text-sm font-medium text-mint-ink">Scribble is awake and private on this computer.</p>}
          {device === 'available' && median !== null && (
            <p className="mt-1 text-sm text-ink-2" role="status">
              Speed here: about <span className="font-semibold tabular text-ink">{(median / 1000).toFixed(1)} s</span> per reply.{' '}
              {slow && mode === 'auto' && <span>That&apos;s slow for live tutoring, so Scribble answers from the cloud during challenges.</span>}
              {slow && mode === 'always' && <span>&ldquo;Always on-device&rdquo; is on, so Scribble waits for your laptop.</span>}
            </p>
          )}
          {(device === 'unsupported' || device === 'unavailable') && (
            <NoteCard tone="blue" className="mt-3 flex items-start gap-2 p-3 text-sm">
              <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-sky-ink" aria-hidden />
              <span>Scribble will think in the cloud on this device. For on-device mode, use desktop Chrome 139+ with <code className="font-mono text-xs">chrome://flags/#prompt-api-for-gemini-nano-multimodal-input</code> enabled.{detail ? ` (${detail})` : ''}</span>
            </NoteCard>
          )}
          {device === 'error' && <p className="mt-1 text-sm text-coral-ink">{detail}</p>}
          {!isFirebaseConfigured && <p className="mt-2 text-sm text-muted">Firebase isn&apos;t set up in this build yet, so Scribble can&apos;t be woken through Firebase AI Logic.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {(device === 'downloadable' || device === 'error' || device === 'downloading') && (
              <Button size="sm" onClick={() => void wakeNova()} loading={device === 'downloading'} disabled={!isFirebaseConfigured}>Wake Scribble on this device</Button>
            )}
            {device === 'available' && <Button size="sm" variant="secondary" onClick={() => void wakeNova()} disabled={!isFirebaseConfigured}>Warm up</Button>}
            <Button size="sm" variant="ghost" onClick={() => void checkNanoAvailability()} icon={<RefreshCw className="h-3.5 w-3.5" />}>Check again</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
