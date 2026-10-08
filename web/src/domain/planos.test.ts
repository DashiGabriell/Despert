import { describe, expect, it } from 'vitest'
import {
  resumoDoPlano,
  buscasAgoraRestantes,
  CARENCIA_PADRAO,
  camposDosAjustes,
  carenciaDe,
  descreverLimite,
  estenderPagamento,
  validarAjustes,
  validarCarencia,
  diaDaCarencia,
  diasAteMudar,
  etapaDaOrganizacao,
  excessos,
  LIMITES_PADRAO,
  lerAjustes,
  limiteDe,
  limitesEfetivos,
  permiteEscrita,
  podeAdicionar,
  resumoBuscasAgora,
  situacaoDoLimite,
  ultimoDiaDeAcesso,
  type DadosDeAcesso,
  type Uso,
} from './planos'

const uso = (parcial: Partial<Uso> = {}): Uso => ({ usuarios: 1, oabs: 0, processos: 0, advogados: 1, ...parcial })

describe('limites padrão por plano (ADR-0008)', () => {
  it('Solo: 1 usuário, 1 OAB, 10 processos, 1 busca automática, Buscar agora 1×/dia a cada 30 min, sem papéis nem auditoria', () => {
    expect(LIMITES_PADRAO.solo).toEqual({
      usuarios: 1,
      oabs: 1,
      processos: 10,
      buscas_automaticas: 1,
      intervalo_busca_min: 30,
      buscas_agora_dia: 1,
      papeis: false,
      auditoria: false,
    })
  })

  it('Escritório: até 10 usuários, 1 OAB por advogado, 50 processos, 2 buscas, 15 Buscar agora a cada 10 min', () => {
    expect(LIMITES_PADRAO.escritorio).toEqual({
      usuarios: 10,
      oabs: 'por_advogado',
      processos: 50,
      buscas_automaticas: 2,
      intervalo_busca_min: 10,
      buscas_agora_dia: 15,
      papeis: true,
      auditoria: true,
    })
  })

  it('Corporativo: até 20 usuários, 70 processos e 20 Buscar agora por dia', () => {
    expect(LIMITES_PADRAO.corporativo).toMatchObject({
      usuarios: 20,
      oabs: 'por_advogado',
      processos: 70,
      buscas_agora_dia: 20,
      intervalo_busca_min: 10,
      papeis: true,
      auditoria: true,
    })
  })
})

describe('ajustes do dev por organização', () => {
  it('sobrescrevem só as chaves informadas', () => {
    const limites = limitesEfetivos('solo', { usuarios: 3, papeis: true })
    expect(limites.usuarios).toBe(3)
    expect(limites.papeis).toBe(true)
    expect(limites.processos).toBe(10)
  })

  it('aceitam OAB fixa no lugar de "por advogado"', () => {
    expect(limitesEfetivos('escritorio', { oabs: 4 }).oabs).toBe(4)
    expect(limitesEfetivos('solo', { oabs: 'por_advogado' }).oabs).toBe('por_advogado')
  })

  it('descartam chaves desconhecidas, tipos errados e valores fora da faixa', () => {
    expect(lerAjustes({ usuarios: 0, processos: -1, buscas_automaticas: 3, papeis: 'sim', extra: 1 })).toEqual({})
    expect(lerAjustes({ usuarios: 2.5 })).toEqual({})
    expect(lerAjustes(null)).toEqual({})
    expect(lerAjustes([1, 2])).toEqual({})
    expect(limitesEfetivos('corporativo', 'lixo')).toEqual(LIMITES_PADRAO.corporativo)
  })
})

describe('limites de quantidade', () => {
  const solo = LIMITES_PADRAO.solo
  const escritorio = LIMITES_PADRAO.escritorio

  it('Solo trava a segunda OAB, o 11º processo e o segundo usuário', () => {
    expect(podeAdicionar('oabs', solo, uso({ oabs: 0 }))).toBe(true)
    expect(podeAdicionar('oabs', solo, uso({ oabs: 1 }))).toBe(false)
    expect(podeAdicionar('processos', solo, uso({ processos: 9 }))).toBe(true)
    expect(podeAdicionar('processos', solo, uso({ processos: 10 }))).toBe(false)
    expect(podeAdicionar('usuarios', solo, uso({ usuarios: 1 }))).toBe(false)
  })

  it('"1 OAB por advogado" acompanha quantos membros advogam', () => {
    expect(limiteDe('oabs', escritorio, 3)).toBe(3)
    expect(podeAdicionar('oabs', escritorio, uso({ oabs: 2, advogados: 3 }))).toBe(true)
    expect(podeAdicionar('oabs', escritorio, uso({ oabs: 3, advogados: 3 }))).toBe(false)
  })

  it('avisa a partir de 80% do limite', () => {
    expect(situacaoDoLimite(39, 50)).toBe('livre')
    expect(situacaoDoLimite(40, 50)).toBe('perto')
    expect(situacaoDoLimite(50, 50)).toBe('cheio')
    expect(situacaoDoLimite(51, 50)).toBe('excedido')
    expect(situacaoDoLimite(0, 1)).toBe('livre')
    expect(situacaoDoLimite(1, 1)).toBe('cheio')
  })

  it('aponta o excesso depois de trocar para um plano menor', () => {
    expect(excessos(solo, uso({ usuarios: 3, oabs: 2, processos: 10, advogados: 2 }))).toEqual(['usuarios', 'oabs'])
    expect(excessos(escritorio, uso({ usuarios: 3, oabs: 2, processos: 10, advogados: 2 }))).toEqual([])
  })
})

describe('teste e carência', () => {
  const carencia = CARENCIA_PADRAO
  const teste: DadosDeAcesso = {
    situacao: 'teste',
    teste_iniciado_em: '2026-10-01T15:00:00Z',
    criado_em: '2026-10-01T15:00:00Z',
    pago_ate: null,
  }
  const ativa: DadosDeAcesso = { ...teste, situacao: 'ativa', pago_ate: '2026-10-31' }

  it('o teste dura 7 dias contando o dia do cadastro', () => {
    expect(ultimoDiaDeAcesso(teste, carencia)).toBe('2026-10-07')
    expect(etapaDaOrganizacao(teste, '2026-10-07', carencia)).toBe('teste')
    expect(diasAteMudar(teste, '2026-10-01', carencia)).toBe(7)
  })

  it('usa a data de Brasília do início do teste', () => {
    const tarde = { ...teste, teste_iniciado_em: '2026-10-02T01:30:00Z' }
    expect(ultimoDiaDeAcesso(tarde, carencia)).toBe('2026-10-07')
  })

  it('dias 1 a 5 depois do vencimento: aviso, tudo funcionando', () => {
    expect(diaDaCarencia(teste, '2026-10-08', carencia)).toBe(1)
    expect(etapaDaOrganizacao(teste, '2026-10-08', carencia)).toBe('aviso')
    expect(etapaDaOrganizacao(teste, '2026-10-12', carencia)).toBe('aviso')
    expect(diasAteMudar(teste, '2026-10-08', carencia)).toBe(5)
    expect(permiteEscrita('aviso')).toBe(true)
  })

  it('dias 6 a 15: somente leitura', () => {
    expect(etapaDaOrganizacao(teste, '2026-10-13', carencia)).toBe('leitura')
    expect(etapaDaOrganizacao(teste, '2026-10-22', carencia)).toBe('leitura')
    expect(permiteEscrita('leitura')).toBe(false)
  })

  it('depois do dia 15: suspensa', () => {
    expect(etapaDaOrganizacao(teste, '2026-10-23', carencia)).toBe('suspensa')
    expect(diasAteMudar(teste, '2026-10-23', carencia)).toBeNull()
    expect(permiteEscrita('suspensa')).toBe(false)
  })

  it('organização ativa vence no último dia pago; sem vencimento nunca entra em carência', () => {
    expect(etapaDaOrganizacao(ativa, '2026-10-31', carencia)).toBe('ativa')
    expect(etapaDaOrganizacao(ativa, '2026-11-01', carencia)).toBe('aviso')
    expect(etapaDaOrganizacao({ ...ativa, pago_ate: null }, '2030-01-01', carencia)).toBe('ativa')
    expect(diasAteMudar({ ...ativa, pago_ate: null }, '2030-01-01', carencia)).toBeNull()
    expect(permiteEscrita('ativa')).toBe(true)
    expect(permiteEscrita('teste')).toBe(true)
  })

  it('respeita os dias configurados pelo dev', () => {
    const curta = { dias_teste: 3, carencia_aviso_dias: 1, carencia_total_dias: 2 }
    expect(etapaDaOrganizacao(teste, '2026-10-03', curta)).toBe('teste')
    expect(etapaDaOrganizacao(teste, '2026-10-04', curta)).toBe('aviso')
    expect(etapaDaOrganizacao(teste, '2026-10-05', curta)).toBe('leitura')
    expect(etapaDaOrganizacao(teste, '2026-10-06', curta)).toBe('suspensa')
  })
})

describe('formulário de ajustes (painel dev)', () => {
  it('vai e volta sem perder nada; vazio = padrão do plano', () => {
    const campos = camposDosAjustes({ usuarios: 15, oabs: 'por_advogado', papeis: false })
    expect(campos).toMatchObject({ usuarios: '15', oabs: 'por_advogado', papeis: 'nao', processos: '' })
    expect(validarAjustes(campos)).toEqual({ ok: true, valor: { usuarios: 15, oabs: 'por_advogado', papeis: false } })
  })

  it('recusa número fora da faixa ou quebrado, com o nome do limite', () => {
    const vazio = camposDosAjustes({})
    expect(validarAjustes({ ...vazio, usuarios: '0' })).toEqual({
      ok: false,
      erro: 'Usuários: use um número inteiro de 1 a 500.',
    })
    expect(validarAjustes({ ...vazio, buscas_automaticas: '3' }).ok).toBe(false)
    expect(validarAjustes({ ...vazio, processos: '2,5' }).ok).toBe(false)
    expect(validarAjustes({ ...vazio, auditoria: 'talvez' }).ok).toBe(false)
  })

  it('descreve os limites para a tabela do painel', () => {
    expect(descreverLimite('por_advogado')).toBe('1 por advogado')
    expect(descreverLimite(true)).toBe('sim')
    expect(descreverLimite(false)).toBe('não')
    expect(descreverLimite(30)).toBe('30')
  })
})

describe('dias de teste e carência (painel dev)', () => {
  it('aceita a configuração padrão', () => {
    expect(validarCarencia({ dias_teste: '7', carencia_aviso_dias: '5', carencia_total_dias: '15' })).toEqual({
      ok: true,
      valor: CARENCIA_PADRAO,
    })
  })

  it('recusa campos vazios, fora da faixa e aviso maior que a carência total', () => {
    expect(validarCarencia({ dias_teste: '', carencia_aviso_dias: '5', carencia_total_dias: '15' }).ok).toBe(false)
    expect(validarCarencia({ dias_teste: '0', carencia_aviso_dias: '5', carencia_total_dias: '15' }).ok).toBe(false)
    expect(validarCarencia({ dias_teste: '7', carencia_aviso_dias: '10', carencia_total_dias: '5' })).toEqual({
      ok: false,
      erro: 'Os dias de aviso não podem passar da carência total.',
    })
  })
})

describe('registro de pagamento (painel dev)', () => {
  it('estende a partir do vencimento quando ele ainda não passou', () => {
    expect(estenderPagamento('2026-10-31', '2026-10-07', 1)).toBe('2026-11-30')
    expect(estenderPagamento('2026-10-07', '2026-10-07', 12)).toBe('2027-10-07')
  })

  it('estende a partir de hoje quando vencido ou sem vencimento', () => {
    expect(estenderPagamento('2026-09-01', '2026-10-07', 1)).toBe('2026-11-07')
    expect(estenderPagamento(null, '2026-10-07', 3)).toBe('2027-01-07')
  })

  it('ajusta o fim de mês', () => {
    expect(estenderPagamento(null, '2027-01-31', 1)).toBe('2027-02-28')
    expect(estenderPagamento(null, '2028-01-31', 1)).toBe('2028-02-29')
  })

  it('usa os dias configurados pelo dev, com o padrão enquanto carrega', () => {
    expect(carenciaDe(null)).toEqual(CARENCIA_PADRAO)
    expect(carenciaDe({ dias_teste: 10, carencia_aviso_dias: 2, carencia_total_dias: 9 })).toEqual({
      dias_teste: 10,
      carencia_aviso_dias: 2,
      carencia_total_dias: 9,
    })
  })
})

describe('Buscar agora da organização', () => {
  it('conta só os disparos do dia de Brasília e acha o mais recente', () => {
    const agora = Date.parse('2026-10-07T12:00:00Z')
    const buscas = [
      { criado_em: '2026-10-07T10:00:00Z' },
      { criado_em: '2026-10-07T02:59:00Z' }, // 23:59 do dia 6 em Brasília
      { criado_em: '2026-10-07T11:30:00Z' },
    ]
    expect(resumoBuscasAgora(buscas, agora)).toEqual({ hoje: 2, ultima: '2026-10-07T11:30:00Z' })
    expect(resumoBuscasAgora([], agora)).toEqual({ hoje: 0, ultima: null })
  })

  it('não acumula: o restante do dia nunca passa do limite nem fica negativo', () => {
    expect(buscasAgoraRestantes(LIMITES_PADRAO.escritorio, 0)).toBe(15)
    expect(buscasAgoraRestantes(LIMITES_PADRAO.solo, 1)).toBe(0)
    expect(buscasAgoraRestantes(LIMITES_PADRAO.solo, 3)).toBe(0)
  })
})

describe('resumoDoPlano', () => {
  const HOJE = '2026-10-06'
  const org = (parcial: Partial<Parameters<typeof resumoDoPlano>[0]>) => ({
    plano: 'escritorio' as const,
    situacao: 'ativa' as const,
    teste_iniciado_em: null,
    criado_em: '2026-01-01T12:00:00Z',
    pago_ate: null,
    ...parcial,
  })

  it('teste: dias restantes e data final; no último dia avisa', () => {
    const emTeste = resumoDoPlano(
      org({ plano: 'solo', situacao: 'teste', teste_iniciado_em: '2026-10-02T12:00:00Z' }),
      HOJE,
      CARENCIA_PADRAO,
    )
    expect(emTeste).toEqual({
      plano: 'Solo',
      etapa: 'teste',
      situacao: 'Período de teste',
      detalhe: 'Faltam 3 dias de teste (até 08/10/2026).',
    })
    const ultimo = resumoDoPlano(
      org({ situacao: 'teste', teste_iniciado_em: '2026-09-30T12:00:00Z' }),
      HOJE,
      CARENCIA_PADRAO,
    )
    expect(ultimo.detalhe).toBe('Hoje é o último dia do teste.')
  })

  it('ativa em dia não tem detalhe', () => {
    expect(resumoDoPlano(org({}), HOJE, CARENCIA_PADRAO)).toEqual({
      plano: 'Escritório',
      etapa: 'ativa',
      situacao: 'Ativa',
      detalhe: null,
    })
    expect(resumoDoPlano(org({ pago_ate: '2026-12-31' }), HOJE, CARENCIA_PADRAO).detalhe).toBeNull()
  })

  it('carência: aviso, somente leitura e suspensa com o prazo de cada etapa', () => {
    const aviso = resumoDoPlano(org({ pago_ate: '2026-10-03' }), HOJE, CARENCIA_PADRAO)
    expect(aviso.situacao).toBe('Acesso vencido (em aviso)')
    expect(aviso.detalhe).toMatch(/^Tudo continua funcionando por mais 3 dias;/)
    const leitura = resumoDoPlano(org({ pago_ate: '2026-09-26' }), HOJE, CARENCIA_PADRAO)
    expect(leitura.situacao).toBe('Somente leitura')
    expect(leitura.detalhe).toMatch(/por mais 6 dias; depois, o acesso é suspenso/)
    const suspensa = resumoDoPlano(org({ plano: 'corporativo', pago_ate: '2026-09-01' }), HOJE, CARENCIA_PADRAO)
    expect(suspensa).toMatchObject({ plano: 'Corporativo', etapa: 'suspensa', situacao: 'Suspensa' })
  })
})
