import { describe, expect, it } from 'vitest'
import { seloDoPrazo } from './selo'

const HOJE = '2026-10-06'

describe('seloDoPrazo', () => {
  it('descreve cada situação de urgência em texto', () => {
    const aberto = { status: 'pendente' as const }
    expect(seloDoPrazo({ ...aberto, vencimento: '2026-10-05' }, HOJE)).toEqual({
      urgencia: 'vencido',
      texto: 'Vencido há 1 dia',
    })
    expect(seloDoPrazo({ ...aberto, vencimento: '2026-10-01' }, HOJE).texto).toBe(
      'Vencido há 5 dias',
    )
    expect(seloDoPrazo({ ...aberto, vencimento: HOJE }, HOJE).texto).toBe('Vence hoje')
    expect(seloDoPrazo({ ...aberto, vencimento: '2026-10-07' }, HOJE).texto).toBe('Amanhã')
    expect(seloDoPrazo({ ...aberto, vencimento: '2026-10-09' }, HOJE)).toEqual({
      urgencia: 'urgente',
      texto: 'Em 3 dias',
    })
    expect(seloDoPrazo({ ...aberto, vencimento: '2026-10-30' }, HOJE)).toEqual({
      urgencia: 'futuro',
      texto: 'Em 24 dias',
    })
    expect(seloDoPrazo({ ...aberto, vencimento: null }, HOJE).texto).toBe('Sem data')
  })

  it('para prazos fechados mostra o status no lugar da contagem', () => {
    expect(seloDoPrazo({ status: 'cumprido', vencimento: '2026-10-01' }, HOJE)).toEqual({
      urgencia: 'fechado',
      texto: 'Cumprido',
    })
    expect(seloDoPrazo({ status: 'arquivado', vencimento: null }, HOJE).texto).toBe('Arquivado')
  })
})
