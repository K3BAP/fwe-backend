import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui'

/** Schlichtes, zentriertes Layout für Login/Register (ohne App-Chrome). */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="grid min-h-svh place-items-center bg-base-200 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Link to="/landing" aria-label="FlightMeet — Startseite">
            <Logo />
          </Link>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 p-6 shadow-card sm:p-8">
          <h1 className="font-display text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-base-content/60">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <p className="mt-5 text-center text-sm text-base-content/60">{footer}</p>}
      </div>
    </div>
  )
}
