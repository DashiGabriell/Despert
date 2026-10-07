import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EstadoDoPlano } from '../data/plano'
import { CARENCIA_PADRAO, LIMITES_PADRAO } from '../domain/planos'
import type { Monitoramento as TipoMonitoramento } from '../lib/database.types'
import Monitoramento from './Monitoramento'

let monitoramentos: TipoMonitoramento[] = []
let plano: EstadoDoPlano
const criar = vi.fn()

vi.mock('../lib/auth-context', () => ({ useUserId: () => 'advogada-1' }))
vi.mock('../lib/organizacao-context', () => ({ useOrganizacaoId: () => 'org-1' }))
vi.mock('../data/plano', () => ({ usePlano: () => plano }))
vi.mock('../data/queries', () => ({
  useMonitoramentos: () => ({ data: monitoramentos, isPending: false, isError: false, isSuccess: true }),
  useMembros: () => ({
    data: [{ organizacao_id: 'org-1', user_id: 'advogada-1', papel: 'administrador', criado_em: '' }],
  }),
  useCriarMonitoramento: () => ({ mutate: criar, isPending: false }),
  useAlternarMonitoramento: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoverMonitoramento: () => ({ mutate: vi.fn() }),
}))

let sequencia = 0
function monitoramento(parcial: Partial<TipoMonitoramento>): TipoMonitoramento {
  sequencia++
  return {
    id: sequencia,
    organizacao_id: 'org-1',
    user_id: 'advogada-1',
    tipo: 'processo',
    oab_numero: null,
    oab_uf: null,
    numero_processo: String(sequencia).padStart(20, '0'),
    descricao: null,
    ativo: true,
    created_at: '2026-10-01T10:00:00Z',
    ...parcial,
  }
}

function renderizar() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Monitoramento />
    </QueryClientProvider>,
  )
}

describe('tela de Monitoramento com limites do plano', () => {
  beforeEach(() => {
    criar.mockReset()
    plano = {
      limites: LIMITES_PADRAO.solo,
      etapa: 'ativa',
      carencia: CARENCIA_PADRAO,
      diasAteMudar: null,
      escrita: true,
    }
    monitoramentos = [monitoramento({ tipo: 'oab', oab_numero: '123', oab_uf: 'SP', numero_processo: null })]
  })

  it('mostra o uso e trava a segunda OAB no Solo', () => {
    renderizar()
    expect(screen.getByText(/OABs monitoradas ativos:/)).toHaveTextContent('1 de 1')
    expect(screen.getByText(/limite de OABs monitoradas foi atingido/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled()
  })

  it('libera processo avulso enquanto houver vaga e avisa a partir de 80%', async () => {
    monitoramentos.push(...Array.from({ length: 8 }, () => monitoramento({})))
    renderizar()
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'processo')
    expect(screen.getByText(/Perto do limite/)).toHaveTextContent('8 de 10')
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeEnabled()
  })

  it('processo pausado não conta para o limite', async () => {
    monitoramentos.push(...Array.from({ length: 10 }, () => monitoramento({ ativo: false })))
    renderizar()
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'processo')
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeEnabled()
  })

  it('em somente leitura desliga cadastro, chaves e remoção', () => {
    plano = { ...plano, etapa: 'leitura', escrita: false, limites: LIMITES_PADRAO.escritorio }
    renderizar()
    expect(screen.getByText(/modo somente leitura/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled()
    expect(screen.getByRole('checkbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remover' })).toBeDisabled()
  })
})
