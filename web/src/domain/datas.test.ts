import { describe, expect, it } from 'vitest'
import {
  ehDataISO,
  formatarData,
  gradeDoMes,
  hojeISO,
  nomeDoMes,
  somarDias,
  somarMeses,
} from './datas'

describe('hojeISO', () => {
  it('usa o fuso de Brasília, não o UTC', () => {
    // 02:30 UTC de 07/10 ainda é 23:30 de 06/10 em Brasília
    expect(hojeISO(new Date('2026-10-07T02:30:00Z'))).toBe('2026-10-06')
    expect(hojeISO(new Date('2026-10-07T03:30:00Z'))).toBe('2026-10-07')
  })
})

describe('ehDataISO', () => {
  it('aceita só datas de calendário válidas no formato YYYY-MM-DD', () => {
    expect(ehDataISO('2026-02-28')).toBe(true)
    expect(ehDataISO('2026-02-30')).toBe(false)
    expect(ehDataISO('28/02/2026')).toBe(false)
    expect(ehDataISO('')).toBe(false)
    expect(ehDataISO(null)).toBe(false)
  })
})

describe('somarDias e formatarData', () => {
  it('atravessa virada de mês e de ano', () => {
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('formata em dd/mm/aaaa e usa travessão sem data', () => {
    expect(formatarData('2026-10-06')).toBe('06/10/2026')
    expect(formatarData(null)).toBe('—')
  })
})

describe('meses da agenda', () => {
  it('navega entre meses atravessando o ano', () => {
    expect(somarMeses('2026-12', 1)).toBe('2027-01')
    expect(somarMeses('2026-01', -1)).toBe('2025-12')
    expect(nomeDoMes('2026-10')).toBe('Outubro de 2026')
  })

  it('monta 6 semanas começando no domingo anterior ao dia 1', () => {
    const grade = gradeDoMes('2026-10') // 01/10/2026 é quinta-feira
    expect(grade).toHaveLength(42)
    expect(grade[0]).toBe('2026-09-27')
    expect(grade[4]).toBe('2026-10-01')
    expect(grade[41]).toBe('2026-11-07')
  })
})
