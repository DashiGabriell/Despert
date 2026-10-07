import { describe, expect, it } from 'vitest'
import { contarIndicadores } from './indicadores'
import type { PrazoUrgencia } from './urgencia'

const HOJE = '2026-10-06'

function prazo(parcial: Partial<PrazoUrgencia>): PrazoUrgencia {
  return { status: 'pendente', vencimento: '2026-10-30', origem_prazo: 'Identificado no texto', ...parcial }
}

describe('contarIndicadores', () => {
  it('conta cada recorte a partir dos prazos em aberto', () => {
    const prazos = [
      prazo({ vencimento: '2026-10-01' }), // vencido
      prazo({ vencimento: HOJE }), // hoje (entra também na semana)
      prazo({ vencimento: '2026-10-09' }), // semana
      prazo({ vencimento: '2026-10-30', status: 'conferir' }), // conferir
      prazo({ vencimento: '2026-10-02', status: 'cumprido' }), // fechado: fora de tudo
      prazo({ vencimento: HOJE, status: 'arquivado' }), // fechado: fora de tudo
    ]

    expect(contarIndicadores(prazos, HOJE)).toEqual({
      vencido: 1,
      hoje: 1,
      semana: 2,
      conferir: 1,
      abertos: 4,
    })
  })

  it('zera tudo quando não há prazos', () => {
    expect(contarIndicadores([], HOJE)).toEqual({
      vencido: 0,
      hoje: 0,
      semana: 0,
      conferir: 0,
      abertos: 0,
    })
  })
})
