import { describe, expect, it } from 'vitest'
import { filtrarPrazos, type PrazoFiltravel } from './filtros'

function prazo(parcial: Partial<PrazoFiltravel> = {}): PrazoFiltravel {
  return {
    status: 'pendente',
    vencimento: '2026-10-09',
    origem_prazo: 'Art. 319 CPC',
    processo: '0801234-56.2026.8.26.0100',
    tribunal: 'TJSP',
    orgao: '1ª Vara Cível',
    tipo: 'prazo ordinário',
    classe: 'Procedimento Comum',
    partes: 'ACME LTDA. X INDUSTRIA BOA',
    teor: null,
    observacoes: null,
    ...parcial,
  }
}

const HOJE = '2026-10-06'

describe('filtrarPrazos', () => {
  it('acha por texto livre ignorando caixa, em processo, tribunal e partes', () => {
    const alvo = prazo()
    const outro = prazo({ processo: '9999999-00.2026.8.26.0000', partes: 'OUTRO E REU' })

    const resultado = filtrarPrazos([alvo, outro], { busca: 'acme', hoje: HOJE })

    expect(resultado).toEqual([alvo])
  })

  it('com status "abertos" esconde cumpridos e arquivados', () => {
    const pendente = prazo()
    const cumprido = prazo({ status: 'cumprido' })
    const arquivado = prazo({ status: 'arquivado' })

    expect(
      filtrarPrazos([pendente, cumprido, arquivado], { status: 'abertos', hoje: HOJE }),
    ).toEqual([pendente])
  })

  it('com status específico filtra por ele, e "todos" mantém tudo', () => {
    const pendente = prazo()
    const conferir = prazo({ status: 'conferir' })

    expect(filtrarPrazos([pendente, conferir], { status: 'conferir', hoje: HOJE })).toEqual([
      conferir,
    ])
    expect(filtrarPrazos([pendente, conferir], { status: 'todos', hoje: HOJE })).toHaveLength(2)
  })

  it('com filtro rápido "vencido", só devolve os vencidos', () => {
    const vencido = prazo({ vencimento: '2026-10-05' })
    const futuro = prazo({ vencimento: '2026-10-20' })

    expect(filtrarPrazos([vencido, futuro], { rapido: 'vencido', hoje: HOJE })).toEqual([vencido])
  })

  it('filtros rápidos "hoje" e "semana" seguem a classificação de urgência', () => {
    const venceHoje = prazo({ vencimento: '2026-10-06' })
    const amanha = prazo({ vencimento: '2026-10-07' })
    const emCincoDias = prazo({ vencimento: '2026-10-11' })
    const emDezoitoDias = prazo({ vencimento: '2026-10-24' })

    expect(filtrarPrazos([venceHoje, emDezoitoDias], { rapido: 'hoje', hoje: HOJE })).toEqual([
      venceHoje,
    ])
    expect(
      filtrarPrazos([venceHoje, amanha, emCincoDias, emDezoitoDias], {
        rapido: 'semana',
        hoje: HOJE,
      }),
    ).toEqual([venceHoje, amanha, emCincoDias])
  })

  it('com filtro rápido "conferir", devolve só o que o advogado precisa confirmar', () => {
    const precisaConfirmar = prazo({ origem_prazo: 'Padrão (15 dias)' })
    const certo = prazo()

    expect(filtrarPrazos([certo, precisaConfirmar], { rapido: 'conferir', hoje: HOJE })).toEqual([
      precisaConfirmar,
    ])
  })
})
