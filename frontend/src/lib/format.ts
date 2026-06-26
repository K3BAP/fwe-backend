const dateFmt = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const timeFmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })

/** „Sa, 28. Juni · 17:00" aus einem ISO-Zeitstempel. */
export function formatMeetupDate(iso: string): string {
  const d = new Date(iso)
  return `${dateFmt.format(d)} · ${timeFmt.format(d)}`
}

const relFmt = new Intl.RelativeTimeFormat('de-DE', { numeric: 'auto' })
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

/** „vor 2 Std.", „gestern", „vor 3 Tagen" aus einem ISO-Zeitstempel (relativ zu jetzt). */
export function formatRelativeTime(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return 'gerade eben'
  for (const [unit, secs] of STEPS) {
    if (abs >= secs) return relFmt.format(Math.round(seconds / secs), unit)
  }
  return 'gerade eben'
}
