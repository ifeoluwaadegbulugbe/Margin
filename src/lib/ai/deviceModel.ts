import { getModels } from './models';
import { warmUpDevice } from './inference';
import { useAiStatus, type DeviceStatus } from '@/stores/aiStatus';

interface PromptApi {
  availability(options?: unknown): Promise<string>;
}

const languageModel = (): PromptApi | undefined => (globalThis as { LanguageModel?: PromptApi }).LanguageModel;

/** UI status only: actual routing is done by the SDK (PREFER_ON_DEVICE). */
export async function checkNanoAvailability(): Promise<DeviceStatus> {
  const store = useAiStatus.getState();
  const LM = languageModel();
  if (!LM) {
    store.setDevice('unsupported', 'The Prompt API is not available in this browser (needs desktop Chrome 139+ with the Prompt API flag).');
    return 'unsupported';
  }
  try {
    const a = await LM.availability({ expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] });
    const status: DeviceStatus = a === 'available' || a === 'downloadable' || a === 'downloading' ? a : 'unavailable';
    store.setDevice(status, status === 'unavailable' ? 'This device does not meet Gemini Nano hardware requirements.' : null);
    return status;
  } catch (e) {
    store.setDevice('error', String(e));
    return 'error';
  }
}

/** Must be called from a click handler (a user gesture), before the first prompt. */
export async function wakeNova(): Promise<boolean> {
  const store = useAiStatus.getState();
  const models = getModels();
  if (!models) {
    store.setDevice('error', 'Firebase is not configured, so the on-device model cannot be initialised through Firebase AI Logic.');
    return false;
  }
  store.setDevice('downloading');
  store.setProgress(0);
  try {
    await models.tutorModel.initializeDeviceModel((p: number) => store.setProgress(Math.max(0, Math.min(1, p))));
    store.setProgress(1);
    await checkNanoAvailability();
    const ok = useAiStatus.getState().device === 'available';
    if (ok) void warmUpDevice();
    return ok;
  } catch (e) {
    store.setDevice('error', String(e));
    return false;
  }
}
