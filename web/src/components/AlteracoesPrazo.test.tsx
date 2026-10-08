import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AlteracaoPrazo, MembroDaEquipe } from '../lib/database.types'
import AlteracoesPrazo from './AlteracoesPrazo'

let resultado: { data?: AlteracaoPrazo[]; isPending: boolean; isSuccess: boolean; isError: boolean; error?: Error }

vi.mock('../data/queries', () => ({ useAlteracoesDoPrazo: () => resultado }))

const EQUIPE: MembroDaEquipe[] = [
  { user_id: 'ana-1', email: 'ana@exemplo.com', papel: 'administrador', criado_em: '' },
  { user_id: 'bruno-1', email: 'bruno@exemplo.com', papel: 'advogado', criado_em: '' },
]

function sucesso(data: AlteracaoPrazo[]) {
  resultado = { data, isPending: false, isSuccess: true, isError: false }
}

describe('AlteracoesPrazo', () => {
  beforeEach(() => sucesso([]))

  it('mostra quem cumpriu, trocou o responsável e o que o suporte mudou', () => {
    sucesso([
      {
        criado_em: '2026-10-06T15:00:00Z',
        autor_email: 'dev@despert.dev',
        por_dev: true,
        acao: 'update:prazos',
        antes: { vencimento: '2026-10-10' },
        depois: { vencimento: '2026-10-20' },
      },
      {
        criado_em: '2026-10-06T14:00:00Z',
        autor_email: 'bruno@exemplo.com',
        por_dev: false,
        acao: 'update:prazos',
        antes: { status: 'pendente', responsavel_id: 'ana-1' },
        depois: { status: 'cumprido', responsavel_id: 'bruno-1' },
      },
    ])
    render(<AlteracoesPrazo prazoId="p1" membros={EQUIPE} />)
    const itens = screen.getAllByRole('listitem')
    expect(itens[0]).toHaveTextContent('Suporte Despert — vencimento: 10/10/2026 → 20/10/2026')
    expect(itens[1]).toHaveTextContent(
      'bruno@exemplo.com — responsável: ana@exemplo.com → bruno@exemplo.com · status: Pendente → Cumprido',
    )
  })

  it('sem alterações, diz isso', () => {
    render(<AlteracoesPrazo prazoId="p1" membros={EQUIPE} />)
    expect(screen.getByText('Nenhuma alteração feita pela equipe neste prazo.')).toBeInTheDocument()
  })

  it('mostra a recusa do banco', () => {
    resultado = { isPending: false, isSuccess: false, isError: true, error: new Error('O plano desta organização não inclui auditoria.') }
    render(<AlteracoesPrazo prazoId="p1" membros={EQUIPE} />)
    expect(screen.getByText(/não inclui auditoria/)).toBeInTheDocument()
  })
})
