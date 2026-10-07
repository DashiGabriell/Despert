import { describe, expect, it } from 'vitest'
import type { MembroComOrganizacao } from '../lib/database.types'
import { organizacaoAtiva } from './organizacao'

function pertenca(id: string, criadoEm: string): MembroComOrganizacao {
  return {
    organizacao_id: id,
    user_id: 'pessoa-1',
    papel: 'administrador',
    criado_em: criadoEm,
    organizacao: {
      id,
      nome: id,
      rotulo: 'escritorio',
      plano: 'solo',
      situacao: 'ativa',
      teste_iniciado_em: null,
      criado_em: criadoEm,
    },
  }
}

describe('organização ativa', () => {
  it('sem nenhuma pertença não há organização', () => {
    expect(organizacaoAtiva([])).toBeNull()
  })

  it('com uma só, é ela', () => {
    expect(organizacaoAtiva([pertenca('org-a', '2026-01-01T00:00:00Z')])?.organizacao_id).toBe('org-a')
  })

  it('com várias e sem preferência, é a mais antiga', () => {
    const lista = [pertenca('nova', '2026-05-01T00:00:00Z'), pertenca('antiga', '2026-01-01T00:00:00Z')]
    expect(organizacaoAtiva(lista)?.organizacao_id).toBe('antiga')
  })

  it('a preferência vale quando a pessoa ainda pertence à organização', () => {
    const lista = [pertenca('antiga', '2026-01-01T00:00:00Z'), pertenca('nova', '2026-05-01T00:00:00Z')]
    expect(organizacaoAtiva(lista, 'nova')?.organizacao_id).toBe('nova')
  })

  it('preferência por organização que a pessoa deixou é ignorada', () => {
    const lista = [pertenca('antiga', '2026-01-01T00:00:00Z')]
    expect(organizacaoAtiva(lista, 'removida')?.organizacao_id).toBe('antiga')
  })
})
