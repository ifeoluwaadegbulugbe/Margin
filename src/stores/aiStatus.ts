import { create } from 'zustand';

export type DeviceStatus = 'checking' | 'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'available' | 'error';
export type Source = 'ON_DEVICE' | 'IN_CLOUD' | 'IN_CLOUD (by mode)' | 'SCRIPTED';

export interface InferenceLogEntry {
  id: number;
  at: number;
  role: 'Scribble' | 'Guide';
  task: string;
  mode: string;
  source: Source;
  latencyMs: number;
  validation: 'valid' | 'repaired' | 'retried' | 'failed' | 'error';
  note?: string;
}

interface AiStatusState {
  device: DeviceStatus;
  deviceDetail: string | null;
  progress: number;
  forceCloud: boolean;
  log: InferenceLogEntry[];
  lastSource: Source | null;
  lastLatency: number | null;
  lastError: string | null;
  setDevice: (d: DeviceStatus, detail?: string | null) => void;
  setProgress: (p: number) => void;
  setForceCloud: (v: boolean) => void;
  addLog: (e: Omit<InferenceLogEntry, 'id' | 'at'>) => void;
  setError: (e: string | null) => void;
  /** auto: use the cloud for live turns when on-device is slow on this laptop; always: wait for on-device (demos). */
  deviceMode: DeviceMode;
  setDeviceMode: (m: DeviceMode) => void;
  /** Recent on-device reply times in ms (persisted), used to decide whether on-device is fast enough. */
  deviceLatencies: number[];
  addDeviceLatency: (ms: number) => void;
}

export type DeviceMode = 'auto' | 'always';
/** On-device replies slower than this (median) count as too slow for live tutoring in auto mode. */
export const DEVICE_SLOW_MS = 12000;

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key: string, v: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* memory only */
  }
};

export const medianLatency = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
export const deviceIsSlow = (xs: number[]) => {
  const m = medianLatency(xs);
  return m !== null && m > DEVICE_SLOW_MS;
};

const readForceCloud = () => {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem('margin.forceCloud') === '1';
  } catch {
    return false;
  }
};

let nextId = 1;

export const useAiStatus = create<AiStatusState>((set) => ({
  device: 'checking',
  deviceDetail: null,
  progress: 0,
  forceCloud: readForceCloud(),
  log: [],
  lastSource: null,
  lastLatency: null,
  lastError: null,
  setDevice: (device, deviceDetail = null) => set({ device, deviceDetail }),
  setProgress: (progress) => set({ progress }),
  setForceCloud: (forceCloud) => {
    try {
      window.localStorage.setItem('margin.forceCloud', forceCloud ? '1' : '0');
    } catch {
      /* storage unavailable: keep in memory */
    }
    set({ forceCloud });
  },
  addLog: (e) =>
    set((s) => ({
      log: [{ ...e, id: nextId++, at: Date.now() }, ...s.log].slice(0, 50),
      ...(e.role === 'Scribble' ? { lastSource: e.source, lastLatency: e.latencyMs } : {}),
    })),
  setError: (lastError) => set({ lastError }),
  deviceMode: readJson<DeviceMode>('margin.deviceMode', 'auto'),
  setDeviceMode: (deviceMode) => {
    writeJson('margin.deviceMode', deviceMode);
    set({ deviceMode });
  },
  deviceLatencies: readJson<number[]>('margin.deviceLatencies', []),
  addDeviceLatency: (ms) =>
    set((s) => {
      const deviceLatencies = [...s.deviceLatencies, Math.round(ms)].slice(-5);
      writeJson('margin.deviceLatencies', deviceLatencies);
      return { deviceLatencies };
    }),
}));
