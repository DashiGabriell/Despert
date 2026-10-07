import { describe, expect, it } from 'vitest'
import { formatarCNJ, validarCNJ } from './cnj'

describe('validarCNJ', () => {
  it('aceita o número completo com máscara do CNJ', () => {
    expect(validarCNJ('0801234-56.2026.8.26.0100')).toBe(true)
  })

  it('aceita os 20 dígitos sem separadores', () => {
    expect(validarCNJ('08012345620268260100')).toBe(true)
  })

  it('rejeita número incompleto, vazio ou com dígitos a menos', () => {
    expect(validarCNJ('0801234562026826010')).toBe(false)
    expect(validarCNJ('0801234-56.2026.8.26.010')).toBe(false)
    expect(validarCNJ('')).toBe(false)
  })
})

describe('formatarCNJ', () => {
  it('só existe quando há validação', () => {
    expect(formatarCNJ('08012345620268260100')).toBe('0801234-56.2026.8.26.0100')
  })

  it('devolve o valor original quando não tem 20 dígitos', () => {
    expect(formatarCNJ('1234567')).toBe('1234567')
  })
})
