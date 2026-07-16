import { useEffect, useState } from 'react'
import { TextField } from '@/components/ui'

/**
 * Suchfeld der Admin-Listen: lokal + **entprellt**, damit nicht jeder Tastendruck eine Abfrage
 * auslöst — dasselbe Muster wie `MeetupFilters` (dort mit derselben 300-ms-Schwelle).
 *
 * Entprellt statt „auf Enter/Blur": ein Suchfeld, das erst beim Wegklicken filtert, fühlt sich
 * kaputt an — und Enter allein ist unauffindbar. Der Sync-Block fängt Änderungen von außen ab
 * (Zurück-Button, geteilter Link), ohne den Tipp-Zustand zu überschreiben.
 */
export function AdminSearchField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string
  onChange: (next: string) => void
  label: string
  placeholder: string
}) {
  const [search, setSearch] = useState(value)
  const [synced, setSynced] = useState(value)
  if (value !== synced) {
    setSynced(value)
    setSearch(value)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== value) onChange(search)
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bewusst nur auf `search` reagieren
  }, [search])

  return (
    <TextField
      type="search"
      aria-label={label}
      placeholder={placeholder}
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="max-w-xs"
    />
  )
}
