import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pode } from '../domain/permissoes'
import type { Configuracao, ConfiguracaoOrganizacao, MembroDaEquipe, PapelMembro } from '../lib/database.types'
import Configuracoes from './Configuracoes'

let papel: PapelMembro = 'administrador'
let membros: MembroDaEquipe[] = []
const salvarPessoal = vi.fn()
const salvarOrganizacao = vi.fn()

const CONFIG: Configuracao = {
  user_id: 'ana-1',
  email_destino: 'ana@exemplo.com',
  dias_alerta: 5,
  resumo_escopo: null,
  updated_at: '2026-10-01T10:00:00Z',
}
const CONFIG_ORG: ConfiguracaoOrganizacao = {
  organizacao_id: 'org-1',
  dias_retroativos: 7,
  prazo_padrao_dias: 15,
  considerar_recesso: true,
  webhook_token: 'TokenDaOrganizacao123',
  updated_at: '2026-10-01T10:00:00Z',
}

vi.mock('../lib/auth-context', () => ({ useUserId: () => 'ana-1', useEmailEfetivo: () => 'ana@exemplo.com' }))
vi.mock('../lib/organizacao-context', () => ({
  useOrganizacaoId: () => 'org-1',
  usePertenca: () => ({ organizacao_id: 'org-1', papel }),
  usePode: () => (acao: Parameters<typeof pode>[1]) => pode(papel, acao),
}))
vi.mock('../data/plano', () => ({ usePlano: () => ({ escrita: true }) }))
vi.mock('../data/queries', () => ({
  useConfiguracao: () => ({ data: CONFIG, isPending: false, isError: false }),
  useConfiguracaoOrganizacao: () => ({ data: CONFIG_ORG, isPending: false, isError: false }),
  useMembros: () => ({ data: membros }),
  useFeriados: () => ({
    data: [{ organizacao_id: 'org-1', data: '2026-02-16', descricao: 'Carnaval' }],
    isSuccess: true,
    isError: false,
  }),
  useCriarFeriado: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoverFeriado: () => ({ mutate: vi.fn() }),
  useSalvarConfiguracao: () => ({ mutate: salvarPessoal, isPending: false }),
  useSalvarConfiguracaoOrganizacao: () => ({ mutate: salvarOrganizacao, isPending: false }),
}))

const EQUIPE: MembroDaEquipe[] = [
  { user_id: 'ana-1', email: 'ana@exemplo.com', papel: 'administrador', criado_em: '' },
  { user_id: 'bruno-1', email: 'bruno@exemplo.com', papel: 'advogado', criado_em: '' },
]

describe('tela de Configurações', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    papel = 'administrador'
    membros = EQUIPE
  })

  it('Administrador altera o robô da organização e os feriados', async () => {
    render(<Configuracoes />)
    expect(screen.getByLabelText('Dias para trás')).toHaveValue(7)
    expect(screen.getByLabelText('Data')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover' })).toBeEnabled()

    await userEvent.clear(screen.getByLabelText('Dias para trás'))
    await userEvent.type(screen.getByLabelText('Dias para trás'), '10')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }))
    expect(salvarOrganizacao).toHaveBeenCalledWith(
      expect.objectContaining({ dias_retroativos: 10, prazo_padrao_dias: 15, webhook_token: 'TokenDaOrganizacao123' }),
      expect.anything(),
    )
  })

  it.each(['advogado', 'assistente', 'leitura'] as const)('%s só vê o resumo do robô e dos feriados', (p) => {
    papel = p
    render(<Configuracoes />)
    expect(screen.queryByLabelText('Dias para trás')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Token de segurança')).not.toBeInTheDocument()
    expect(screen.getByText(/Só o Administrador da organização altera essas configurações/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Data')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument()
    expect(screen.getByText('Carnaval')).toBeInTheDocument()
  })

  it.each([
    ['advogado', 'meus'],
    ['administrador', 'todos'],
    ['assistente', 'todos'],
    ['leitura', 'todos'],
  ] as const)('o resumo diário de %s começa em "%s"', (p, escopo) => {
    papel = p
    render(<Configuracoes />)
    expect(screen.getByLabelText('Resumo diário')).toHaveValue(escopo)
  })

  it('cada pessoa salva os próprios alertas, inclusive o escopo do resumo', async () => {
    papel = 'leitura'
    render(<Configuracoes />)
    await userEvent.selectOptions(screen.getByLabelText('Resumo diário'), 'meus')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alertas' }))
    expect(salvarPessoal).toHaveBeenCalledWith(
      { email_destino: 'ana@exemplo.com', dias_alerta: 5, resumo_escopo: 'meus' },
      expect.anything(),
    )
  })

  it('no Solo não pergunta o escopo do resumo', () => {
    membros = EQUIPE.slice(0, 1)
    render(<Configuracoes />)
    expect(screen.queryByLabelText('Resumo diário')).not.toBeInTheDocument()
  })
})
