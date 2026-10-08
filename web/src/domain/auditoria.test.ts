import { describe, expect, it } from 'vitest'
import { fabricarPrazo, fabricarRegistro } from '../test/fabricas'
import {
  AUTOR_SUPORTE,
  autorDaAlteracao,
  categoriaDaAcao,
  csvDaAuditoria,
  csvDePrazos,
  descreverAlteracao,
  descreverRegistro,
  filtrarAuditoria,
  intervaloDoPeriodo,
  nomeDoArquivo,
  rotuloDoAutor,
} from './auditoria'

const NOMES = new Map([
  ['ana-1', 'ana@exemplo.com'],
  ['bruno-1', 'bruno@exemplo.com'],
])

describe('categoriaDaAcao', () => {
  it.each([
    ['update:prazos', 'prazos'],
    ['insert:monitoramentos', 'monitoramentos'],
    ['delete:feriados_organizacao', 'feriados'],
    ['update:configuracoes_organizacao', 'configuracoes'],
    ['update:configuracoes', 'configuracoes'],
    ['update:membros', 'equipe'],
    ['insert:convites', 'equipe'],
    ['exportar_prazos', 'exportacoes'],
    ['atuar_como', 'suporte'],
    ['bloquear', 'suporte'],
  ])('%s → %s', (acao, categoria) => {
    expect(categoriaDaAcao(acao)).toBe(categoria)
  })
})

describe('filtrarAuditoria', () => {
  const doBruno = fabricarRegistro()
  const daAna = fabricarRegistro({ membro_id: 'ana-1', membro_email: 'ana@exemplo.com', acao: 'insert:convites' })
  const doDev = fabricarRegistro({ membro_id: null, membro_email: null, dev_id: 'dev-1', acao: 'atuar_como' })
  const todos = [doBruno, daAna, doDev]

  it('sem filtro devolve tudo', () => {
    expect(filtrarAuditoria(todos, { autor: '', categoria: '' })).toEqual(todos)
  })

  it('filtra por membro, pelo suporte e por tipo', () => {
    expect(filtrarAuditoria(todos, { autor: 'ana-1', categoria: '' })).toEqual([daAna])
    expect(filtrarAuditoria(todos, { autor: AUTOR_SUPORTE, categoria: '' })).toEqual([doDev])
    expect(filtrarAuditoria(todos, { autor: '', categoria: 'prazos' })).toEqual([doBruno])
    expect(filtrarAuditoria(todos, { autor: 'bruno-1', categoria: 'equipe' })).toEqual([])
  })

  it('o autor do dev aparece como Suporte Despert; ex-membro sem e-mail tem rótulo próprio', () => {
    expect(rotuloDoAutor(doDev)).toBe('Suporte Despert')
    expect(rotuloDoAutor(doBruno)).toBe('bruno@exemplo.com')
    expect(rotuloDoAutor({ membro_id: 'x', membro_email: null })).toBe('Ex-membro da equipe')
  })
})

describe('intervaloDoPeriodo', () => {
  it('usa o dia de Brasília e inclui o último dia inteiro', () => {
    expect(intervaloDoPeriodo('2026-10-01', '2026-10-06')).toEqual({
      de: '2026-10-01T00:00:00-03:00',
      ate: '2026-10-07T03:00:00.000Z',
    })
    expect(intervaloDoPeriodo('', '')).toEqual({})
  })
})

describe('descreverRegistro', () => {
  it('lista o que mudou com rótulos, nomes e datas legíveis', () => {
    const registro = fabricarRegistro({
      detalhe: { registro: 'p1', processo: '0801234', campos: ['responsavel_id', 'status', 'vencimento'] },
      antes: { status: 'pendente', responsavel_id: 'ana-1', vencimento: '2026-10-10' },
      depois: { status: 'cumprido', responsavel_id: 'bruno-1', vencimento: '2026-10-12' },
    })
    expect(descreverRegistro(registro, NOMES)).toBe(
      'processo 0801234 · responsável: ana@exemplo.com → bruno@exemplo.com · status: Pendente → Cumprido · vencimento: 10/10/2026 → 12/10/2026',
    )
  })

  it('responsável que saiu da equipe e valores vazios', () => {
    const registro = fabricarRegistro({ antes: { responsavel_id: 'velho-1' }, depois: { responsavel_id: null } })
    expect(descreverRegistro(registro, NOMES)).toBe('responsável: fora da equipe → —')
  })

  it('criação e exclusão identificam o registro', () => {
    expect(
      descreverRegistro(
        fabricarRegistro({ acao: 'insert:monitoramentos', depois: { tipo: 'oab', oab_numero: '321', oab_uf: 'SP' } }),
        NOMES,
      ),
    ).toBe('OAB 321/SP')
    expect(
      descreverRegistro(
        fabricarRegistro({ acao: 'delete:feriados_organizacao', antes: { data: '2026-11-20', descricao: 'Consciência Negra' } }),
        NOMES,
      ),
    ).toBe('20/11/2026 · Consciência Negra')
    expect(
      descreverRegistro(
        fabricarRegistro({
          acao: 'insert:convites',
          detalhe: { email: 'carla@exemplo.com', papel: 'assistente' },
          depois: { papel: 'assistente', token: '•••' },
        }),
        NOMES,
      ),
    ).toBe('carla@exemplo.com · Assistente')
  })
})

describe('histórico do prazo', () => {
  it('descreve criação e mudanças, com o suporte identificado', () => {
    expect(
      descreverAlteracao(
        { criado_em: '', autor_email: 'ana@exemplo.com', por_dev: false, acao: 'insert:prazos', antes: null, depois: {} },
        NOMES,
      ),
    ).toBe('Criou o prazo')
    const mudanca = {
      criado_em: '',
      autor_email: 'dev@despert.dev',
      por_dev: true,
      acao: 'update:prazos',
      antes: { vencimento: '2026-10-10' },
      depois: { vencimento: '2026-10-20' },
    }
    expect(descreverAlteracao(mudanca, NOMES)).toBe('vencimento: 10/10/2026 → 20/10/2026')
    expect(autorDaAlteracao(mudanca)).toBe('Suporte Despert')
  })
})

describe('exportação', () => {
  it('nome do arquivo com a data', () => {
    expect(nomeDoArquivo('prazos', '2026-10-06')).toBe('prazos-2026-10-06.csv')
  })

  it('CSV de prazos com datas pt-BR, status legível e responsável pelo e-mail', () => {
    const csv = csvDePrazos(
      [fabricarPrazo({ responsavel_id: 'bruno-1', tambem_intimados: ['ana-1', 'velho-1'], observacoes: 'ver; urgente' })],
      NOMES,
    )
    const [cabecalho, linha] = csv.replace('\uFEFF', '').split('\r\n')
    expect(cabecalho.split(';')).toContain('Vencimento')
    expect(linha).toContain(';23/10/2026;Pendente;bruno@exemplo.com;ana@exemplo.com, Fora da equipe;')
    expect(linha).toContain('"ver; urgente"')
    expect(csv.startsWith('\uFEFF')).toBe(true)
  })

  it('CSV da auditoria com autor, ação e alterações', () => {
    const csv = csvDaAuditoria(
      [
        fabricarRegistro({ antes: { status: 'pendente' }, depois: { status: 'cumprido' } }),
        fabricarRegistro({ membro_id: null, membro_email: null, dev_id: 'dev-1', acao: 'atuar_como' }),
      ],
      NOMES,
    )
    const linhas = csv.replace('\uFEFF', '').split('\r\n')
    expect(linhas[0]).toBe('Data e hora;Autor;Ação;Alterações')
    expect(linhas[1]).toMatch(/;bruno@exemplo\.com;Alterou prazo;status: Pendente → Cumprido$/)
    expect(linhas[2]).toMatch(/;Suporte Despert;Entrou como advogado;$/)
  })
})
