'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Play } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth, isFirebaseConfigured } from '@/stores/auth';
import { useProfile } from '@/stores/profile';
import { useAiStatus, deviceIsSlow } from '@/stores/aiStatus';
import { runPostSessionStrategist } from '@/stores/session';
import { watchList } from '@/lib/ai/strategist';
import { DEFAULT_CLOUD_MODEL, STRATEGIST_MODEL } from '@/lib/ai/models';
import { Button, Card, Label, NoteCard, cx } from '@/components/ui';
import { DevicePanel } from '@/components/learn/DevicePanel';
import { InferenceTable, downloadLog } from '@/components/learn/InferenceLog';
import type { Tone, YearGroup } from '@/types/domain';

const DEMO = process.env.NEXT_PUBLIC_DEMO_CONTROLS !== 'false';

export default function SettingsPage() {
  return <AppShell wide><Settings /></AppShell>;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors', on ? 'bg-violet' : 'bg-line')}>
      <span className={cx('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform', on ? 'translate-x-6' : 'translate-x-1')} />
    </button>
  );
}

const selectCls = 'mt-1 h-11 w-full rounded-[12px] border border-line bg-white px-3 focus:border-violet focus:outline-none';

function Settings() {
  const router = useRouter();
  const { isAnonymous, linkGoogle, signOut, repo } = useAuth();
  const { user, update, insight, misconceptions, strategistPending, sessions } = useProfile();
  const { forceCloud, setForceCloud, device, lastError, deviceMode, setDeviceMode, deviceLatencies } = useAiStatus();
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);
  if (!user) return null;
  const wl = watchList(insight, misconceptions);

  return (
    <div className="space-y-6">
      <div>
        <Label>Settings</Label>
        <h1 className="mt-2 font-display text-[32px] font-extrabold leading-10">Your notebook &amp; AI engine</h1>
      </div>
      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="h-fit lg:col-span-4">
          <Label>Profile</Label>
          <p className="mt-2 font-semibold">{user.displayName ?? 'Guest learner'}</p>
          <p className="text-sm text-muted">{repo.kind === 'firestore' ? (isAnonymous ? 'Guest account (Firebase)' : 'Signed in with Google') : 'Local mode: your notebook stays in this browser'}</p>
          {isAnonymous && isFirebaseConfigured && (
            <Button size="sm" variant="secondary" className="mt-3" onClick={async () => setLinkMsg((await linkGoogle()) ?? 'Saved. Your notebook is now linked to Google.')}>Save my notebook to Google</Button>
          )}
          {linkMsg && <p className="mt-2 text-sm text-ink-2">{linkMsg}</p>}

          <Label className="mt-6">Learning level</Label>
          <select value={String(user.yearGroup)} onChange={(e) => void update({ yearGroup: (e.target.value === 'adult' ? 'adult' : Number(e.target.value)) as YearGroup })} className={selectCls}>
            {[7, 8, 9, 10, 11, 12, 13].map((y) => <option key={y} value={y}>Year {y}</option>)}
            <option value="adult">University / adult</option>
          </select>
          <Label className="mt-4">Daily goal</Label>
          <select value={user.dailyGoal} onChange={(e) => void update({ dailyGoal: Number(e.target.value) as 1 | 2 | 3 })} className={selectCls}>
            {[1, 2, 3].map((g) => <option key={g} value={g}>{g} challenge{g > 1 ? 's' : ''} a day</option>)}
          </select>
          <Label className="mt-4">Scribble&apos;s tone</Label>
          <select value={user.tone} onChange={(e) => void update({ tone: e.target.value as Tone })} className={selectCls}>
            <option value="encouraging">Encouraging</option><option value="direct">Direct</option>
          </select>
          <Button variant="danger" size="sm" className="mt-6" onClick={async () => { await signOut(); router.replace('/'); }}>Sign out</Button>
        </Card>

        <div className="space-y-5 lg:col-span-8">
          <Card>
            <h2 className="font-display text-[24px] font-bold">AI engine</h2>
            <p className="mt-1 text-sm text-ink-2">Everything needed to check hybrid inference. Labels come from the SDK&apos;s <code className="font-mono">inferenceSource</code>, never from a guess.</p>
            <div className="mt-4"><DevicePanel /></div>
            <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Scribble (tutor) mode</dt><dd className="font-mono">{forceCloud ? 'ONLY_IN_CLOUD (forced)' : deviceMode === 'auto' && deviceIsSlow(deviceLatencies) ? 'ONLY_IN_CLOUD (device slow)' : 'PREFER_ON_DEVICE'}</dd></div>
              <div><dt className="text-muted">On-device reply times</dt><dd className="font-mono">{deviceLatencies.length ? deviceLatencies.map((ms) => `${(ms / 1000).toFixed(1)}s`).join(', ') : 'not measured yet'}</dd></div>
              <div><dt className="text-muted">Device model</dt><dd className="font-mono">Gemini Nano · {device}</dd></div>
              <div><dt className="text-muted">Cloud tutor model</dt><dd className="font-mono">{DEFAULT_CLOUD_MODEL}</dd></div>
              <div><dt className="text-muted">Learning guide</dt><dd className="font-mono">ONLY_IN_CLOUD · {STRATEGIST_MODEL}</dd></div>
              <div><dt className="text-muted">Backend</dt><dd className="font-mono">{isFirebaseConfigured ? 'Firebase AI Logic · Gemini Developer API' : 'not configured (local mode)'}</dd></div>
              <div><dt className="text-muted">Data</dt><dd className="font-mono">{repo.kind === 'firestore' ? 'Cloud Firestore' : 'this browser'}</dd></div>
            </dl>
            {lastError && <NoteCard tone="coral" className="mt-4 text-sm">{lastError}</NoteCard>}
            {DEMO && (
              <div className="mt-5 space-y-4 rounded-[16px] border border-sky/40 bg-pale-blue p-4">
                <div className="flex items-center justify-between gap-4">
                  <div><div className="font-semibold">Force cloud tutor</div><div className="text-sm text-ink-2">Demonstration control: routes Scribble through ONLY_IN_CLOUD.</div></div>
                  <Toggle on={forceCloud} onChange={setForceCloud} label="Force cloud tutor" />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div><div className="font-semibold">Always on-device</div><div className="text-sm text-ink-2">For recording the private on-device demo: Scribble waits for Gemini Nano even when it is slow on this laptop. Off = use the cloud for live turns when on-device is slower than 12 s.</div></div>
                  <Toggle on={deviceMode === 'always'} onChange={(v) => setDeviceMode(v ? 'always' : 'auto')} label="Always on-device" />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div><div className="font-semibold">Run the learning guide now</div><div className="text-sm text-ink-2">Cloud analysis of your last {Math.min(8, sessions.length)} sessions.</div></div>
                  <Button size="sm" variant="secondary" icon={<Play className="h-4 w-4" />} loading={strategistPending} disabled={cooldown}
                    onClick={async () => { setCooldown(true); setTimeout(() => setCooldown(false), 60000); await runPostSessionStrategist('post_session'); }}>Run</Button>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <Label>What Scribble knows about you</Label>
            <p className="mt-1 text-sm text-ink-2">Exactly what goes into the WATCH line of every Scribble prompt:</p>
            <pre className="paper-grid mt-2 overflow-x-auto rounded-[12px] border border-line p-3 font-mono text-sm text-violet-ink">{`STUDENT: ${user.yearGroup === 'adult' ? 'adult learner' : `year ${user.yearGroup}`}, tone ${user.tone}\n${wl.phrases.length ? `WATCH: ${wl.phrases.join('; ')}` : 'WATCH: (nothing yet)'}`}</pre>
          </Card>

          <Card>
            <div className="flex items-center justify-between"><Label>Live AI log</Label><Button size="sm" variant="ghost" icon={<Download className="h-4 w-4" />} onClick={downloadLog}>JSON</Button></div>
            <div className="mt-2"><InferenceTable /></div>
          </Card>

          <NoteCard tone="sun" className="p-5">
            <div className="font-hand text-[24px] text-sun-ink">What is sent to the cloud</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
              <li><span className="text-ink">On-device (default):</span> Scribble&apos;s prompt never leaves your computer.</li>
              <li><span className="text-ink">Cloud tutor (fallback or forced):</span> the problem, your latest line (max 200 characters), stage, hint level and watch-list. No name, no email, no chat history.</li>
              <li><span className="text-ink">Learning guide (always cloud):</span> problem IDs, counts, hint levels, timings and mistake types. Never what you typed.</li>
              <li>Your explanations are rated by Scribble (on the device when available); only the rating is stored.</li>
            </ul>
          </NoteCard>
        </div>
      </div>
    </div>
  );
}
