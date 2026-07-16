import { describe, it, expect } from 'vitest'
import { meetupBriefingSchema } from './briefing'
import { briefingTable } from '@/mocks/briefing'

describe('briefing schema (API-Vertrag)', () => {
  it('akzeptiert ein vorhandenes Briefing', () => {
    const dto = {
      available: true,
      reason: null,
      text: 'Leichter Südwestwind bei klarem Himmel.',
      generated_at: '2026-07-12T08:04:11Z',
    }
    expect(meetupBriefingSchema.parse(dto)).toEqual(dto)
  })

  it('akzeptiert „nicht eingerichtet" als Datenzustand', () => {
    const dto = { available: false, reason: 'not_configured', text: null, generated_at: null }
    expect(meetupBriefingSchema.parse(dto)).toEqual(dto)
  })

  it('verwirft einen unbekannten Grund', () => {
    const dto = { available: false, reason: 'quota', text: null, generated_at: null }
    expect(meetupBriefingSchema.safeParse(dto).success).toBe(false)
  })

  it('Mock-Briefings erfüllen den Vertrag (künftig und vergangen)', () => {
    const future = briefingTable.forMeetup(2, new Date(Date.now() + 86400_000).toISOString())
    const past = briefingTable.forMeetup(2, new Date(Date.now() - 86400_000).toISOString())
    expect(meetupBriefingSchema.parse(future).available).toBe(true)
    expect(meetupBriefingSchema.parse(past).reason).toBe('past')
  })
})
