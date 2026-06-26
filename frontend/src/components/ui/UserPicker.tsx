import { useMemo, useState } from 'react'
import { useUsers } from '@/api/users'
import type { PublicUserCard } from '@/api/schemas'
import { Avatar } from './Avatar'
import { Field } from './FormField'
import { fieldControlClass } from './fieldControl'

/** Nutzersuche (@-Suche) für gerichtete Einladungen / neue DMs. `exclude` blendet IDs aus. */
export function UserPicker({
  label,
  exclude,
  onSelect,
}: {
  label?: string
  exclude?: number[]
  onSelect: (user: PublicUserCard) => void
}) {
  const { data: users } = useUsers()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (users ?? [])
      .filter((u) => !exclude?.includes(u.id))
      .filter((u) => !q || u.display_name.toLowerCase().includes(q) || (u.handle?.toLowerCase().includes(q) ?? false))
      .slice(0, 6)
  }, [users, query, exclude])

  return (
    <Field label={label}>
      <div className="relative">
        <input
          className={fieldControlClass()}
          placeholder="Pilot suchen…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoComplete="off"
        />
        {open && results.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-2xl border border-base-300 bg-base-100 p-1 shadow-popover">
            {results.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(u)
                    setQuery('')
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left hover:bg-base-200"
                >
                  <Avatar name={u.display_name} src={u.avatar_path} size={28} />
                  <span className="font-medium">{u.display_name}</span>
                  {u.handle && <span className="text-xs text-base-content/50">@{u.handle}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  )
}
