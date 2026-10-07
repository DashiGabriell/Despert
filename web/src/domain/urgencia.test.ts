import { describe, expect, it } from 'vitest'
import { classificarUrgencia, precisaConferir, type PrazoUrgencia } from './urgencia'

function prazo(parcial: Partial<PrazoUrgencia> = {}): PrazoUrgencia {
  return {
    status: 'pendente',
    vencimento: '2026-10-20',
    origem_prazo: 'Petição inicial — Art. 319 CPC',
    ...parcial,
  }
}

describe('classificarUrgencia', () => {
  it('marca como vencido quando o vencimento já passou', () => {
    expect(classificarUrgencia(prazo({ vencimento: '2026-10-05' }), '2026-10-06')).toBe(
      'vencido',
    )
  })

  it('marca "hoje" quando vence no próprio dia', () => {
    expect(classificarUrgencia(prazo({ vencimento: '2026-10-06' }), '2026-10-06')).toBe('hoje')
  })

  it('marca "urgente" quando faltam até 3 dias', () => {
    expect(classificarUrgencia(prazo({ vencimento: '2026-10-09' }), '2026-10-06')).toBe('urgente')
    expect(classificarUrgencia(prazo({ vencimento: '2026-10-07' }), '2026-10-06')).toBe('urgente')
  })

  it('marca "proximo" até 7 dias e "futuro" a partir de 8', () => {
    expect(classificarUrgencia(prazo({ vencimento: '2026-10-13' }), '2026-10-06')).toBe('proximo')
    expect(classificarUrgencia(prazo({ vencimento: '2026-10-10' }), '2026-10-06')).toBe('proximo')
    expect(classificarUrgencia(prazo({ vencimento: '2026-10-14' }), '2026-10-06')).toBe('futuro')
  })

  it('marca "semdata" quando não há vencimento apurado', () => {
    expect(classificarUrgencia(prazo({ vencimento: null }), '2026-10-06')).toBe('semdata')
  })

  it('marca "fechado" quando o prazo está cumprido ou arquivado', () => {
    expect(classificarUrgencia(prazo({ status: 'cumprido' }), '2026-10-06')).toBe('fechado')
    expect(
      classificarUrgencia(prazo({ status: 'arquivado', vencimento: '2026-10-05' }), '2026-10-06'),
    ).toBe('fechado')
  })
})

describe('precisaConferir', () => {
  it('é true quando o status é "conferir"', () => {
    expect(precisaConferir(prazo({ status: 'conferir' }))).toBe(true)
  })

  it('avisa prazo padrão ou ambíguo da origem, mas só enquanto estiver em aberto', () => {
    const padrao = { status: 'pendente', origem_prazo: 'Padrão (15 dias)' } as const
    expect(precisaConferir(prazo(padrao))).toBe(true)
    expect(precisaConferir(prazo({ status: 'pendente', origem_prazo: 'Art. 319 CPC' }))).toBe(false)
    expect(precisaConferir(prazo({ ...padrao, status: 'cumprido' }))).toBe(false)
  })
})
