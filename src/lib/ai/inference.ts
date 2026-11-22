/** Runs a prompt through the right model, with timeout, SDK-reported source and stale-request protection. */
import { InferenceSource, type GenerativeModel } from 'firebase/ai';
import { getModels, DEFAULT_CLOUD_MODEL, STRATEGIST_MODEL } from './models';
import { useAiStatus, deviceIsSlow, type Source } from '@/stores/aiStatus';

export interface InferenceResult {
  requestId: number;
  text: string | null;
  source: Source;
  mode: string;
  latencyMs: number;
  error?: string;
}

let currentRequestId = 0;
export const isCurrent = (id: number) => id === currentRequestId;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function sourceOf(reported: unknown, byModeCloud: boolean): Source {
  if (reported === InferenceSource.ON_DEVICE) return 'ON_DEVICE';
  if (reported === InferenceSource.IN_CLOUD) return 'IN_CLOUD';
  // ONLY_IN_CLOUD may not populate the field; label it honestly as cloud *by mode*.
  return byModeCloud ? 'IN_CLOUD (by mode)' : 'IN_CLOUD';
}

const isAppCheckError = (msg: string) => /app.?check|403|permission|unauthenticated/i.test(msg);

/** Device path time limit: in auto mode a slow reply is abandoned for the cloud; in "always" mode we wait. */
const DEVICE_TIMEOUT_AUTO = 15000;
const DEVICE_TIMEOUT_ALWAYS = 90000;
const CLOUD_TIMEOUT = 15000;

export interface TutorRunResult extends InferenceResult {
  /** The request went down the PREFER_ON_DEVICE path (so a cloud rescue is meaningful). */
  devicePath: boolean;
  timedOut: boolean;
}

/**
 * Routing for one Scribble turn:
 * - forced cloud (demo toggle) or `cloud: true` (rescue) -> ONLY_IN_CLOUD;
 * - auto mode and on-device measured slow on this laptop -> ONLY_IN_CLOUD, labelled as such;
 * - otherwise PREFER_ON_DEVICE (the SDK still falls back to the cloud if Nano is not ready).
 */
export async function runTutor(prompt: string, opts: { cloud?: boolean; keepRequestId?: boolean } = {}): Promise<TutorRunResult> {
  const requestId = opts.keepRequestId ? currentRequestId : ++currentRequestId;
  const models = getModels();
  const st = useAiStatus.getState();
  const slow = st.deviceMode === 'auto' && deviceIsSlow(st.deviceLatencies);
  const cloud = !!opts.cloud || st.forceCloud || slow;
  const mode = opts.cloud ? 'ONLY_IN_CLOUD (rescue)' : st.forceCloud ? 'ONLY_IN_CLOUD' : slow ? 'ONLY_IN_CLOUD (device slow)' : 'PREFER_ON_DEVICE';
  const t0 = performance.now();
  if (!models) {
    return { requestId, text: null, source: 'SCRIPTED', mode, latencyMs: 0, error: 'Firebase not configured', devicePath: false, timedOut: false };
  }
  const model: GenerativeModel = cloud ? models.tutorCloudModel : models.tutorModel;
  const timeout = cloud ? CLOUD_TIMEOUT : st.deviceMode === 'always' ? DEVICE_TIMEOUT_ALWAYS : DEVICE_TIMEOUT_AUTO;
  const res = await run(model, prompt, requestId, mode, timeout, cloud, t0, true);
  if (!cloud) {
    if (res.source === 'ON_DEVICE') st.addDeviceLatency(res.latencyMs);
    else if (res.error === 'timeout') st.addDeviceLatency(timeout); // too slow: counts against the device
  }
  return { ...res, devicePath: !cloud, timedOut: res.error === 'timeout' };
}

let warming: Promise<void> | null = null;
/**
 * Load Gemini Nano into memory with one tiny on-device prompt and record how fast it is,
 * so the first real turn is not the slow one and auto mode knows whether to prefer the cloud.
 */
export function warmUpDevice(): Promise<void> {
  if (warming) return warming;
  warming = (async () => {
    const models = getModels();
    if (!models) return;
    const t0 = performance.now();
    try {
      const r = await withTimeout(models.tutorModel.generateContent('TASK: celebrate\nINSTRUCTION: Say "Ready" in tutor_message.'), DEVICE_TIMEOUT_ALWAYS);
      const src = (r.response as { inferenceSource?: string }).inferenceSource;
      if (src === InferenceSource.ON_DEVICE) {
        const ms = Math.round(performance.now() - t0);
        useAiStatus.getState().addDeviceLatency(ms);
        useAiStatus.getState().addLog({ role: 'Scribble', task: 'warm-up', mode: 'PREFER_ON_DEVICE', source: 'ON_DEVICE', latencyMs: ms, validation: 'valid', note: 'loads Nano and measures its speed' });
      }
    } catch {
      /* warm-up is best effort */
    }
  })();
  return warming;
}

/**
 * The Learning Guide is a background job (it never blocks the student). If the configured model is busy
 * ("high demand"), slow or failing, retry once with the default Flash-Lite model and record which answered.
 */
export async function runStrategist(prompt: string): Promise<InferenceResult & { model: string }> {
  const models = getModels();
  const t0 = performance.now();
  if (!models) return { requestId: -1, text: null, source: 'SCRIPTED', mode: 'ONLY_IN_CLOUD', latencyMs: 0, error: 'Firebase not configured', model: STRATEGIST_MODEL };
  const first = await run(models.strategistModel, prompt, -1, 'ONLY_IN_CLOUD', 20000, true, t0, false);
  if (first.text !== null || !models.strategistFallbackModel || isAppCheckError(first.error ?? '')) return { ...first, model: STRATEGIST_MODEL };
  const t1 = performance.now();
  const second = await run(models.strategistFallbackModel, prompt, -1, `ONLY_IN_CLOUD (backup: ${DEFAULT_CLOUD_MODEL})`, 45000, true, t1, true);
  return { ...second, model: DEFAULT_CLOUD_MODEL, error: second.error ?? undefined, latencyMs: Math.round(performance.now() - t0) };
}

async function run(
  model: GenerativeModel, prompt: string, requestId: number, mode: string, timeoutMs: number,
  byModeCloud: boolean, t0: number, allowNetworkRetry: boolean,
): Promise<InferenceResult> {
  try {
    const result = await withTimeout(model.generateContent(prompt), timeoutMs);
    const reported = (result.response as { inferenceSource?: string }).inferenceSource;
    return { requestId, text: result.response.text(), source: sourceOf(reported, byModeCloud), mode, latencyMs: Math.round(performance.now() - t0) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isAppCheckError(msg)) {
      useAiStatus.getState().setError('Firebase AI Logic rejected the request (App Check). If you are developing locally, register your debug token in the Firebase console.');
    } else if (allowNetworkRetry && msg !== 'timeout' && /network|fetch|failed to fetch|unavailable|503/i.test(msg)) {
      await new Promise((r) => setTimeout(r, 1500));
      return run(model, prompt, requestId, mode, timeoutMs, byModeCloud, t0, false);
    }
    return { requestId, text: null, source: 'SCRIPTED', mode, latencyMs: Math.round(performance.now() - t0), error: msg };
  }
}
