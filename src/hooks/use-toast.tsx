'use client';

import * as React from 'react';

export interface ToastActionButton {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'success' | 'error' | 'warning';
  // 0 (or negative) keeps the toast on screen until dismissed — useful with an action.
  duration?: number;
  action?: ToastActionButton;
}

interface ToastState {
  toasts: Toast[];
}

type ToastAction =
  | { type: 'ADD'; toast: Toast }
  | { type: 'REMOVE'; id: string };

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD':
      return { ...state, toasts: [...state.toasts, action.toast] };
    case 'REMOVE':
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.id),
      };
    default:
      return state;
  }
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (props: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue>({
  toasts: [],
  toast: () => '',
  dismiss: () => {},
});

let idCounter = 0;

function generateId(): string {
  return `toast-${++idCounter}-${Date.now()}`;
}

function classifyAlert(message: string): { title: string; variant: Toast['variant'] } {
  const text = message.trim();
  const lower = text.toLowerCase();

  if (!text) return { title: 'Something needs your attention', variant: 'error' };
  if (/^(offline|queued|pending)\b/.test(lower)) return { title: 'Heads up', variant: 'warning' };
  if (/(fail|error|invalid|required|unauthori[sz]ed|forbidden|cannot|can't|could not|unable|not found|missing|denied|rejected|expired|too large|not allowed|no branch)/.test(lower)) {
    return { title: 'Something needs your attention', variant: 'error' };
  }
  if (/(queued|pending|approval|variance|already|limit|warning|review|attention)/.test(lower)) {
    return { title: 'Heads up', variant: 'warning' };
  }
  if (/(success|saved|created|recorded|updated|deleted|imported|synced|welcome|approved|paid|completed|duplicated|found|done)/.test(lower)) {
    return { title: 'All set', variant: 'success' };
  }
  return { title: 'Notice', variant: 'default' };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(toastReducer, { toasts: [] });

  const dismiss = React.useCallback((id: string) => {
    dispatch({ type: 'REMOVE', id });
  }, []);

  const toast = React.useCallback(
    (props: Omit<Toast, 'id'>) => {
      const id = generateId();
      const duration = props.duration ?? 5000;
      dispatch({ type: 'ADD', toast: { ...props, id } });
      if (duration > 0) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const originalAlert = window.alert;
    window.alert = (message?: unknown) => {
      const description = typeof message === 'string' ? message : String(message ?? '');
      const { title, variant } = classifyAlert(description);
      toast({ title, description: description || undefined, variant, duration: variant === 'error' ? 8000 : 5000 });
    };
    return () => {
      window.alert = originalAlert;
    };
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toasts: state.toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
