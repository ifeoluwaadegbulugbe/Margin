import { create } from 'zustand';

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error';
  text: string;
  persist?: boolean;
  action?: { label: string; run: () => void };
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

let id = 1;
export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const toast = { ...t, id: id++ };
    set({ toasts: [...get().toasts, toast].slice(-4) });
    if (!t.persist) setTimeout(() => get().dismiss(toast.id), 4000);
  },
  dismiss: (tid) => set({ toasts: get().toasts.filter((t) => t.id !== tid) }),
}));
