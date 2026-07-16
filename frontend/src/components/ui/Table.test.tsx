import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SortHeader, Table } from './Table'

/** Der Sort-Header ist nur dann interaktiv, wenn er auch sortieren kann. */
describe('SortHeader', () => {
  const renderHeader = (onSort?: (sort: string) => void) =>
    render(
      <Table>
        <thead>
          <tr>
            <SortHeader label="Name" sortKey="name_asc" active={false} indicator="▲" onSort={onSort} />
          </tr>
        </thead>
        <tbody />
      </Table>,
    )

  it('rendert einen Button, wenn onSort gesetzt ist', () => {
    renderHeader(vi.fn())
    expect(screen.getByRole('button', { name: 'Name' })).toBeInTheDocument()
  })

  it('rendert reinen Text ohne onSort', () => {
    renderHeader()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Name')).toBeInTheDocument()
  })

  it('meldet den aktiven Sortierzustand über aria-pressed', () => {
    render(
      <Table>
        <thead>
          <tr>
            <SortHeader label="Name" sortKey="name_asc" active indicator="▲" onSort={vi.fn()} />
          </tr>
        </thead>
        <tbody />
      </Table>,
    )
    expect(screen.getByRole('button', { name: /Name/ })).toHaveAttribute('aria-pressed', 'true')
  })
})
