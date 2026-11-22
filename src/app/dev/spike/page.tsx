'use client';
/**
 * Phase 0 spike: proves hybrid inference with structured output before anything else.
 * Run (prefer device) should report on_device once Nano is ready; Run (cloud only) should report in_cloud.
 */
import { useState } from 'react';
import { getModels, STRATEGIST_MODEL } from '@/lib/ai/models';
import { wakeNova } from '@/lib/ai/deviceModel';
import { isFirebaseConfigured } from '@/lib/firebase/client';
import { useAiStatus } from '@/stores/aiStatus';
import { Button, Card } from '@/components/ui';

const SAMPLE = `TASK: respond_to_line
STUDENT: year 10, tone encouraging
PROBLEM: Solve 3(x - 2) = 12 | skill: multi-step equations | objective: solve for x
STAGE: STEP 2/3 | next objective: isolate the x term
FACTS:
- Line 1 "3x - 6 = 12" is balanced (progress).
- Line 2 "3x = 6" CHANGED the solution (now x=2). Likely misconception: M-SIGN-MOVE.
STUDENT SAID: 3x = 6
HINT LEVEL: 0
DO NOT SAY: "x = 6", "x=6", "3x = 18", "18"

INSTRUCTION: React to the student's latest line using FACTS. If it CHANGED the solution, point to that line and ask a question about the operation they did.`;

export default function Spike() {
  const [packet, setPacket] = useState(SAMPLE);
  const [out, setOut] = useState<{ raw: string; parsed: unknown; source: unknown; ms: number; mode: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { device, progress } = useAiStatus();

  /** Small Learning Guide call: checks the configured strategist model answers with its JSON schema. */
  const runGuide = async () => {
    const m = getModels();
    if (!m) { setErr('Firebase is not configured (.env.local).'); return; }
    setBusy(true); setErr(null);
    const t0 = performance.now();
    try {
      const r = await m.strategistModel.generateContent('TASK: plan a first expedition.\nINPUT: {"student":{"yearGroup":10},"mastery":{"neg-numbers":0.2},"records":[],"catalog":[{"id":"NN-01","skill":"neg-numbers","difficulty":1,"targets":[],"unlocked":true},{"id":"NN-02","skill":"neg-numbers","difficulty":2,"targets":["M-NEG-SUB"],"unlocked":true}]}');
      const raw = r.response.text();
      let parsed: unknown = null;
      try { parsed = JSON.parse(raw); } catch { parsed = 'INVALID JSON'; }
      setOut({ raw, parsed, source: (r.response as { inferenceSource?: string }).inferenceSource ?? '(by mode: in_cloud)', ms: Math.round(performance.now() - t0), mode: `Learning Guide · ${STRATEGIST_MODEL}` });
    } catch (e) {
      setErr(`${String(e)} (after ${Math.round((performance.now() - t0) / 1000)} s)`);
    } finally {
      setBusy(false);
    }
  };

  const run = async (cloud: boolean) => {
    const m = getModels();
    if (!m) { setErr('Firebase is not configured (.env.local).'); return; }
    setBusy(true); setErr(null);
    const t0 = performance.now();
    try {
      const r = await (cloud ? m.tutorCloudModel : m.tutorModel).generateContent(packet);
      const raw = r.response.text();
      let parsed: unknown = null;
      try { parsed = JSON.parse(raw); } catch { parsed = 'INVALID JSON'; }
      setOut({ raw, parsed, source: (r.response as { inferenceSource?: string }).inferenceSource ?? '(undefined)', ms: Math.round(performance.now() - t0), mode: cloud ? 'ONLY_IN_CLOUD' : 'PREFER_ON_DEVICE' });
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <h1 className="font-display text-2xl font-semibold">Hybrid inference spike</h1>
      <p className="text-sm text-ink-2">Firebase configured: <b>{String(isFirebaseConfigured)}</b> · Gemini Nano: <b className="font-mono">{device}</b>{device === 'downloading' ? ` ${Math.round(progress * 100)}%` : ''}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void wakeNova()}>Wake Scribble</Button>
        <Button onClick={() => void run(false)} loading={busy}>Run (prefer device)</Button>
        <Button variant="secondary" onClick={() => void run(true)} loading={busy}>Run (cloud only)</Button>
        <Button variant="secondary" onClick={() => void runGuide()} loading={busy}>Test Learning Guide model</Button>
      </div>
      <textarea value={packet} onChange={(e) => setPacket(e.target.value)} rows={14} className="w-full rounded-[12px] border border-line bg-white p-3 font-mono text-sm" />
      {err && <p className="text-sm text-coral-ink">{err}</p>}
      {out && (
        <Card className="space-y-2 text-sm">
          <div>mode: <b className="font-mono">{out.mode}</b> · inferenceSource: <b className="font-mono text-mint-ink">{String(out.source)}</b> · {out.ms} ms</div>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-[10px] bg-paper p-3 font-mono">{JSON.stringify(out.parsed, null, 2)}</pre>
          <details><summary>raw</summary><pre className="whitespace-pre-wrap font-mono">{out.raw}</pre></details>
        </Card>
      )}
    </div>
  );
}
