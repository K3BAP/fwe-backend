import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { useMeetupWeather } from '@/api/weather'
import type { WeatherHour } from '@/api/schemas'
import { Card, Skeleton } from '@/components/ui'
import { ArrowUpIcon, CloudIcon, CloudRainIcon, GustIcon, ThermometerIcon, WindIcon } from '@/components/layout/icons'
import { compassPoint, formatClock, formatTemperature, formatWindSpeed } from '@/lib/format'
import { cn } from '@/lib/cn'
import { fadeUp, useMotionConfig } from '@/lib/motion'
import { weatherCodeInfo, windTone } from './weatherCodes'

/**
 * Wetter am Startplatz zur Startzeit des Treffens (ADR-017, Quelle Open-Meteo). Zeigt zuerst, was
 * Gleitschirmflieger vor dem Fahren zum Startplatz interessiert: **Bodenwind und Böen** (farblich
 * betont), dann Wetterlage, Regen, Bewölkung sowie — falls das Modell sie liefert — Höhenwind auf
 * ~1500 m und CAPE als Thermik-Indikator. Der Wind-Trend zeigt die Entwicklung um die Startstunde.
 *
 * Fehlt die Vorhersage (vergangenes Treffen), verschwindet das Panel; ist sie nur gerade nicht zu
 * holen, bleibt eine leise Zeile stehen — Wetter ist Beiwerk und darf die Seite nie stören.
 */
export function WeatherPanel({ meetupId, startsAt }: { meetupId: number; startsAt: string }) {
  const { data, isPending, isError } = useMeetupWeather(meetupId, startsAt)
  const cfg = useMotionConfig()

  if (isPending) return <Skeleton className="h-72 w-full" />
  if (isError) return <Note>Wetterdaten sind derzeit nicht verfügbar.</Note>

  // Vergangene Treffen und Treffen ohne Startplatz-Koordinaten zeigen schlicht kein Wetter.
  if (!data.available || data.snapshot === null) {
    if (data.reason === 'out_of_range') return <Note>Die Vorhersage reicht nur 16 Tage voraus.</Note>
    return null
  }

  const { snapshot } = data
  const { label, Icon } = weatherCodeInfo(snapshot.weather_code)

  return (
    <motion.div {...cfg} variants={fadeUp()}>
      <Card className="flex flex-col gap-4 p-5">
        <header>
          <h2 className="font-display text-lg">Wetter am Treffpunkt</h2>
          <p className="text-sm text-base-content/55">
            {data.is_current ? 'Aktuell' : `Prognose für ${formatClock(snapshot.at)} Uhr`}
          </p>
        </header>

        <div className="flex items-center gap-3">
          <Icon size={30} className="shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="truncate font-display text-xl">{formatTemperature(snapshot.temperature_c)}</div>
            <div className="truncate text-sm text-base-content/60">{label}</div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <WindRow
            icon={<WindIcon size={20} />}
            label="Bodenwind"
            speed={snapshot.wind_speed_kmh}
            kind="wind"
            direction={snapshot.wind_direction_deg}
          />
          <WindRow icon={<GustIcon size={20} />} label="Böen" speed={snapshot.wind_gusts_kmh} kind="gusts" />
        </div>

        <dl className="grid grid-cols-2 gap-3 border-t border-base-300 pt-4">
          <Stat
            icon={<CloudRainIcon size={16} />}
            label="Regen"
            value={
              snapshot.precipitation_probability_pct === null
                ? `${snapshot.precipitation_mm} mm`
                : `${snapshot.precipitation_probability_pct} %`
            }
          />
          <Stat icon={<CloudIcon size={16} />} label="Bewölkung" value={`${snapshot.cloud_cover_pct} %`} />
          {snapshot.wind_1500m_kmh !== null && (
            <Stat
              icon={<WindIcon size={16} />}
              label="Wind ~1500 m"
              value={formatWindSpeed(snapshot.wind_1500m_kmh)}
            />
          )}
          {snapshot.cape_j_kg !== null && (
            <Stat icon={<ThermometerIcon size={16} />} label="Thermik (CAPE)" value={`${Math.round(snapshot.cape_j_kg)} J/kg`} />
          )}
        </dl>

        {data.trend.length > 1 && <Trend hours={data.trend} activeAt={snapshot.at} />}

        <p className="text-xs text-base-content/45">Quelle: Open-Meteo</p>
      </Card>
    </motion.div>
  )
}

/** Bodenwind/Böen — die beiden Zahlen, wegen derer Piloten überhaupt aufs Wetter schauen. */
function WindRow({
  icon,
  label,
  speed,
  kind,
  direction,
}: {
  icon: ReactNode
  label: string
  speed: number
  kind: 'wind' | 'gusts'
  direction?: number
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-base-content/45">{label}</div>
        <div className={cn('font-medium', windTone(speed, kind))}>{formatWindSpeed(speed)}</div>
      </div>
      {direction !== undefined && <WindArrow degrees={direction} />}
    </div>
  )
}

/**
 * Windfahne: `wind_direction_deg` ist meteorologisch die Richtung, **aus der** der Wind kommt —
 * der Pfeil zeigt daher um 180° gedreht dorthin, wohin er weht.
 */
function WindArrow({ degrees }: { degrees: number }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5 text-base-content/60">
      <ArrowUpIcon size={18} style={{ transform: `rotate(${degrees + 180}deg)` }} />
      <span className="text-xs font-medium">aus {compassPoint(degrees)}</span>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-base-content/40">{icon}</span>
      <div className="min-w-0">
        <dt className="truncate text-xs text-base-content/50">{label}</dt>
        <dd className="truncate text-sm font-medium">{value}</dd>
      </div>
    </div>
  )
}

/** Windentwicklung um die Startstunde — zeigt, ob es auffrischt oder abflaut. */
function Trend({ hours, activeAt }: { hours: WeatherHour[]; activeAt: string }) {
  return (
    <div className="border-t border-base-300 pt-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/45">Windverlauf</div>
      <ul className="flex justify-between gap-1">
        {hours.map((hour) => (
          <li
            key={hour.at}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-center',
              hour.at === activeAt && 'bg-base-200',
            )}
          >
            <span className="text-[11px] text-base-content/50">{formatClock(hour.at)}</span>
            <ArrowUpIcon
              size={12}
              className="text-base-content/40"
              style={{ transform: `rotate(${hour.wind_direction_deg + 180}deg)` }}
            />
            <span className={cn('text-xs font-semibold tabular-nums', windTone(hour.wind_speed_kmh))}>
              {Math.round(hour.wind_speed_kmh)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Leise Ersatzzeile: kein Toast, kein Alarm — die Seite funktioniert auch ohne Wetter. */
function Note({ children }: { children: ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="mb-1 font-display text-lg">Wetter am Treffpunkt</h2>
      <p className="text-sm text-base-content/55">{children}</p>
    </Card>
  )
}
