import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ExperienceBadge, StatusBadge } from './Badge'

describe('Badge', () => {
  it('ExperienceBadge rendert das deutsche Level-Label', () => {
    render(<ExperienceBadge level="beginner" />)
    expect(screen.getByText('Anfänger')).toBeInTheDocument()
  })

  it('StatusBadge rendert „Ausgebucht" für full', () => {
    render(<StatusBadge status="full" />)
    expect(screen.getByText('Ausgebucht')).toBeInTheDocument()
  })
})
