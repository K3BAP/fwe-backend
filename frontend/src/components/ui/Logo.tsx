/**
 * Wortmarke + Wing-Icon (Gleitschirm-Canopy + Coral-Sonne auf Sky-Verlauf). `onDark` schaltet die
 * Wortmarke auf Weiß — für dunkle/bildhafte Flächen (Hero-Himmel, Footer), wo `text-base-content`
 * im Light-Theme zu dunkel wäre.
 */
export function Logo({ size = 36, withWordmark = true, onDark = false }: { size?: number; withWordmark?: boolean; onDark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="grid place-items-center rounded-[11px]"
        style={{ width: size, height: size, background: 'linear-gradient(150deg,#5BB8F5,#1E90E6 55%,#0F6FBE)' }}
      >
        <svg width={size * 0.72} height={size * 0.52} viewBox="0 0 64 44" fill="none" aria-hidden>
          <circle cx="45" cy="15" r="7.5" fill="#FF6B4A" />
          <path d="M6 25 C 18 9, 46 9, 58 25 C 46 18, 18 18, 6 25 Z" fill="#fff" />
        </svg>
      </span>
      {withWordmark && (
        <span className={`font-display text-[19px] font-extrabold tracking-tight ${onDark ? 'text-white' : 'text-base-content'}`}>
          Flight<span className={onDark ? 'text-sky-300' : 'text-primary'}>Meet</span>
        </span>
      )}
    </span>
  )
}
