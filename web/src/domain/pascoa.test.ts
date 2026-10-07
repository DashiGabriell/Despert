import { describe, expect, it } from 'vitest'
import { domingoDePascoa } from './pascoa'

describe('domingoDePascoa', () => {
  it('bate com a Páscoa de anos conhecidos', () => {
    expect(domingoDePascoa(2026)).toBe('2026-04-05')
    expect(domingoDePascoa(2027)).toBe('2027-03-28')
    expect(domingoDePascoa(2028)).toBe('2028-04-16')
  })
})
