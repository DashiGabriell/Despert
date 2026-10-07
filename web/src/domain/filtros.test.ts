import { describe, expect, it } from 'vitest'
import { filtrarPorResponsavel, filtrarPrazos, TODOS_RESPONSAVEIS, type PrazoFiltravel } from './filtros'

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

describe('filtro por responsável', () => {
  const meu = prazo({ responsavel_id: 'ana' })
  const dela = prazo({ responsavel_id: 'bia' })
  const semNinguem = prazo({ responsavel_id: null })

  it('"Meus prazos" (o próprio id) mostra só os da pessoa', () => {
    expect(filtrarPorResponsavel([meu, dela, semNinguem], 'ana')).toEqual([meu])
  })

  it('todos ou sem filtro mostra tudo', () => {
    expect(filtrarPorResponsavel([meu, dela, semNinguem], TODOS_RESPONSAVEIS)).toHaveLength(3)
    expect(filtrarPorResponsavel([meu, dela, semNinguem])).toHaveLength(3)
  })

  it('combina com os outros filtros de filtrarPrazos', () => {
    const delaCumprido = prazo({ responsavel_id: 'bia', status: 'cumprido' })
    expect(filtrarPrazos([meu, dela, delaCumprido], { responsavel: 'bia', status: 'abertos', hoje: HOJE })).toEqual([
      dela,
    ])
  })
})

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

  it('com filtro rápido "abertos", devolve pendentes e para conferir', () => {
    const pendente = prazo()
    const conferir = prazo({ status: 'conferir' })
    const cumprido = prazo({ status: 'cumprido' })

    expect(
      filtrarPrazos([pendente, conferir, cumprido], { status: 'todos', rapido: 'abertos', hoje: HOJE }),
    ).toEqual([pendente, conferir])
  })

  it('combina status, filtro rápido e busca textual', () => {
    const alvo = prazo({ vencimento: '2026-10-05' })
    const vencidoDeOutro = prazo({ vencimento: '2026-10-05', partes: 'OUTRA PARTE' })
    const naoVencido = prazo()

    expect(
      filtrarPrazos([alvo, vencidoDeOutro, naoVencido], {
        status: 'abertos',
        rapido: 'vencido',
        busca: 'acme',
        hoje: HOJE,
      }),
    ).toEqual([alvo])
  })

  it('com filtro rápido "conferir", devolve só o que o advogado precisa confirmar', () => {
    const precisaConfirmar = prazo({ origem_prazo: 'Padrão (15 dias)' })
    const certo = prazo()

    expect(filtrarPrazos([certo, precisaConfirmar], { rapido: 'conferir', hoje: HOJE })).toEqual([
      precisaConfirmar,
    ])
  })
})
