import { create } from 'zustand'

/**
 * Schlanker Toast-Store (kapselt DaisyUI-Optik im `<Toaster>`, ADR-013 — keine Toast-Lib).
 * Komponenten/Hooks rufen `toast.success(...)` o.ä. auf; der `<Toaster>`-Host rendert sie animiert.
 */

export type ToastVariant = 'success' | 'error' | 'info'
export type Toast = { id: number; message: string; variant: ToastVariant }

type ToastState = {
  toasts: Toast[]
  show: (message: string, variant?: ToastVariant) => void
  dismiss: (id: number) => void
}

const AUTO_DISMISS_MS = 4000
let nextId = 1

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (message, variant = 'info') => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), AUTO_DISMISS_MS)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** Bequemer Aufruf ohne Hook-Kontext (z.B. in Mutation-Callbacks). */
export const toast = {
  success: (m: string) => useToastStore.getState().show(m, 'success'),
  error: (m: string) => useToastStore.getState().show(m, 'error'),
  info: (m: string) => useToastStore.getState().show(m, 'info'),
}
