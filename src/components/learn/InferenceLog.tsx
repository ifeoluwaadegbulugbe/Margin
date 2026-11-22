'use client';
import { X, Download } from 'lucide-react';
import { useAiStatus } from '@/stores/aiStatus';
import { IconButton, cx } from '@/components/ui';
import { SourceChip } from './SourceChip';

export function InferenceTable({ max = 50 }: { max?: number }) {
  const log = useAiStatus((s) => s.log);
  if (!log.length) return <p className="py-6 text-center text-sm text-muted">No AI calls yet. Every Scribble and Learning Guide call appears here with its SDK-reported source.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="text-[11px] uppercase tracking-[0.08em] text-muted">
          <tr><th className="py-2 pr-3 font-semibold">Time</th><th className="pr-3 font-semibold">Who · task</th><th className="pr-3 font-semibold">Mode</th><th className="pr-3 font-semibold">Reported source</th><th className="pr-3 font-semibold">Latency</th><th className="font-semibold">Validation</th></tr>
        </thead>
        <tbody>
          {log.slice(0, max).map((e) => (
            <tr key={e.id} className="border-t border-line align-top">
              <td className="py-2 pr-3 tabular text-muted">{new Date(e.at).toLocaleTimeString()}</td>
              <td className="py-2 pr-3"><span className={cx('font-semibold', e.role === 'Guide' ? 'text-violet-ink' : 'text-coral-ink')}>{e.role}</span> · {e.task}</td>
              <td className="py-2 pr-3 font-mono text-xs text-ink-2">{e.mode}</td>
              <td className="py-2 pr-3"><SourceChip source={e.source} /></td>
              <td className="py-2 pr-3 tabular text-ink-2">{e.latencyMs} ms</td>
              <td className="py-2">
                <span className={cx('text-xs font-semibold', e.validation === 'valid' ? 'text-mint-ink' : e.validation === 'repaired' || e.validation === 'retried' ? 'text-sun-ink' : 'text-coral-ink')}>{e.validation}</span>
                {e.note && <div className="max-w-[240px] text-xs text-muted">{e.note}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function downloadLog() {
  const blob = new Blob([JSON.stringify(useAiStatus.getState().log, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `margin-inference-log-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function InferenceLog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/30" onClick={onClose} role="dialog" aria-modal aria-label="AI engine log">
      <div className="h-full w-full max-w-[720px] overflow-y-auto border-l border-line bg-paper p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[24px] font-bold">AI engine log</h2>
          <div className="flex gap-1">
            <IconButton label="Download log as JSON" onClick={downloadLog}><Download className="h-5 w-5" /></IconButton>
            <IconButton label="Close" onClick={onClose}><X className="h-5 w-5" /></IconButton>
          </div>
        </div>
        <p className="mb-4 text-sm text-ink-2">Each row is one call. &ldquo;Reported source&rdquo; is <code className="font-mono text-ink">response.inferenceSource</code> from Firebase AI Logic. Offline-script rows are written fallbacks, never labelled as AI.</p>
        <div className="rounded-[18px] border border-line bg-white p-4"><InferenceTable /></div>
      </div>
    </div>
  );
}
