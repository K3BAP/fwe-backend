import { describe, it, expect } from 'vitest'
import { experienceLevelSchema, publicUserCardSchema, reactionSchema } from './common'

describe('common schemas (API-Vertrag)', () => {
  it('publicUserCard akzeptiert nullable handle/avatar', () => {
    const card = { id: 1, display_name: 'Lena Krüger', handle: null, avatar_path: null }
    expect(publicUserCardSchema.parse(card)).toEqual(card)
  })

  it('publicUserCard verwirft fehlende id', () => {
    const result = publicUserCardSchema.safeParse({ display_name: 'X', handle: null, avatar_path: null })
    expect(result.success).toBe(false)
  })

  it('experienceLevel akzeptiert nur das Enum', () => {
    expect(experienceLevelSchema.parse('expert')).toBe('expert')
    expect(experienceLevelSchema.safeParse('pro').success).toBe(false)
  })

  it('reaction macht einen Round-Trip', () => {
    const reaction = { emoji: '🪂', count: 3, me: true }
    expect(reactionSchema.parse(reaction)).toEqual(reaction)
  })
})
