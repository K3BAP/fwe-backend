import { cn } from '@/lib/cn'

/**
 * Gemeinsame Control-Optik (Radius 14, 1.5px-Border, Sky-Fokusring) für TextField/Select/Textarea.
 * Eigene Datei (kein Komponenten-Export), damit Fast-Refresh sauber bleibt.
 */
export function fieldControlClass(error?: string): string {
  return cn(
    'w-full rounded-[14px] border-[1.5px] bg-base-100 px-3.5 py-3 text-[15px] outline-none transition',
    'placeholder:text-base-content/40 focus:border-primary focus:ring-4 focus:ring-primary/15',
    error ? 'border-error' : 'border-base-300',
  )
}
