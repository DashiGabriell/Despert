import { describe, expect, it } from 'vitest'
import {
  montarAtualizacao,
  ORIGEM_AJUSTADA,
  ORIGEM_CONFERIDA,
  recalcularVencimento,
  type EdicaoPrazo,
  type PrazoEditavel,
} from './edicao'

const AGORA = '2026-10-06T13:00:00.000Z'

const original: PrazoEditavel = {
  status: 'conferir',
  vencimento: '2026-10-26',
  prazo_dias: 15,
  inicio_prazo: '2026-10-06',
  observacoes: null,
  cumprido_em: null,
  origem_prazo: 'Padrão (15 dias) - não identificado no texto',
}

function edicao(parcial: Partial<EdicaoPrazo> = {}): EdicaoPrazo {
  return {
    status: original.status,
    vencimento: original.vencimento ?? '',
    prazo_dias: original.prazo_dias,
    inicio_prazo: original.inicio_prazo ?? '',
    observacoes: '',
    ...parcial,
  }
}

describe('recalcularVencimento', () => {
  it('aplica a regra de dias úteis quando há início e dias', () => {
    expect(recalcularVencimento('2026-10-05', 3, {})).toBe('2026-10-07')
    expect(recalcularVencimento('2026-10-05', 2, { feriadosLocais: ['2026-10-06'] })).toBe(
      '2026-10-07',
    )
  })

  it('devolve null quando falta início válido ou dias positivos', () => {
    expect(recalcularVencimento('', 5, {})).toBeNull()
    expect(recalcularVencimento('2026-10-05', 0, {})).toBeNull()
    expect(recalcularVencimento('2026-10-05', null, {})).toBeNull()
  })
})

describe('montarAtualizacao', () => {
  it('ao ajustar a contagem, sai de "para conferir" e marca a origem como ajustada', () => {
    const resultado = montarAtualizacao(
      original,
      edicao({ prazo_dias: 5, vencimento: '2026-10-13' }),
      AGORA,
    )
    expect(resultado).toMatchObject({
      status: 'pendente',
      prazo_dias: 5,
      vencimento: '2026-10-13',
      origem_prazo: ORIGEM_AJUSTADA,
      cumprido_em: null,
    })
  })

  it('confirmar o prazo (conferir → pendente) troca a origem para conferida', () => {
    const resultado = montarAtualizacao(original, edicao({ status: 'pendente' }), AGORA)
    expect(resultado.status).toBe('pendente')
    expect(resultado.origem_prazo).toBe(ORIGEM_CONFERIDA)
  })

  it('sem mudança na contagem preserva a origem do robô', () => {
    const pendente = { ...original, status: 'pendente' as const, origem_prazo: 'Identificado no texto' }
    const resultado = montarAtualizacao(
      pendente,
      edicao({ status: 'pendente', observacoes: '  ligar para o cliente  ' }),
      AGORA,
    )
    expect(resultado.origem_prazo).toBe('Identificado no texto')
    expect(resultado.observacoes).toBe('ligar para o cliente')
  })

  it('registra quando foi cumprido e preserva a data original em edições seguintes', () => {
    expect(montarAtualizacao(original, edicao({ status: 'cumprido' }), AGORA).cumprido_em).toBe(
      AGORA,
    )
    const cumprido = { ...original, status: 'cumprido' as const, cumprido_em: '2026-10-01T10:00:00Z' }
    expect(montarAtualizacao(cumprido, edicao({ status: 'cumprido' }), AGORA).cumprido_em).toBe(
      '2026-10-01T10:00:00Z',
    )
    expect(montarAtualizacao(cumprido, edicao({ status: 'pendente' }), AGORA).cumprido_em).toBeNull()
  })
})
