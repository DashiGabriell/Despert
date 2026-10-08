import { describe, expect, it } from 'vitest'
import { comparacaoDosPlanos, faixaDeUsuarios, formatarPreco, PRECO_MENSAL } from './precos'

describe('preços', () => {
  it('formata em reais com vírgula', () => {
    expect(formatarPreco(PRECO_MENSAL.solo)).toBe('R$ 79,90')
    expect(formatarPreco(PRECO_MENSAL.escritorio)).toBe('R$ 397,90')
    expect(formatarPreco(PRECO_MENSAL.corporativo)).toBe('R$ 849,90')
  })

  it('faixas de usuários seguem o ADR-0008', () => {
    expect(faixaDeUsuarios('solo')).toBe('1')
    expect(faixaDeUsuarios('escritorio')).toBe('2 a 10')
    expect(faixaDeUsuarios('corporativo')).toBe('11 a 20')
  })
})

describe('comparacaoDosPlanos', () => {
  const linha = (rotulo: string) => comparacaoDosPlanos().find((l) => l.rotulo === rotulo)?.valores

  it('descreve os limites padrão de cada plano', () => {
    expect(linha('OABs monitoradas')).toEqual({ solo: '1', escritorio: '1 por advogado', corporativo: '1 por advogado' })
    expect(linha('Processos avulsos')).toEqual({ solo: '10', escritorio: '50', corporativo: '70' })
    expect(linha('Buscas automáticas por dia útil')?.solo).toBe('1, às 07:00')
    expect(linha('Buscas automáticas por dia útil')?.escritorio).toBe('2, às 07:00 e às 12:00')
    expect(linha('Busca agora')?.solo).toBe('1 por dia')
    expect(linha('Busca agora')?.corporativo).toBe('20 por dia, com 10 min de intervalo')
    expect(linha('Auditoria e exportação em CSV')).toEqual({ solo: 'Não', escritorio: 'Sim', corporativo: 'Sim' })
  })
})
