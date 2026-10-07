import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import AuthProvider from './components/AuthProvider'
import ToastProvider from './components/ToastProvider'
import type { MembroComOrganizacao, PapelMembro, Plano, Prazo } from './lib/database.types'
import { fabricarPrazo } from './test/fabricas'

type SessaoTeste = { user: { id: string; email: string; app_metadata?: Record<string, unknown> } }

const auth = vi.hoisted(() => ({
  session: null as null | SessaoTeste,
  devNoBanco: undefined as boolean | undefined,
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('./lib/supabase', () => ({
  supabaseConfigurado: true,
  ausenciaConfiguracao: null,
  supabase: {
    rpc: async () => ({ data: auth.devNoBanco ?? auth.session?.user.app_metadata?.app_role === 'dev', error: null }),
    auth: {
      getSession: async () => ({ data: { session: auth.session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: auth.signInWithPassword,
      signUp: auth.signUp,
      signOut: auth.signOut,
    },
  },
}))

const vazio = { data: [], isPending: false, isError: false, isSuccess: true }

function pertenca(orgId: string, nome: string, papel: PapelMembro, plano: Plano): MembroComOrganizacao {
  return {
    organizacao_id: orgId,
    user_id: 'advogada-1',
    papel,
    criado_em: '2026-10-01T10:00:00Z',
    organizacao: {
      id: orgId,
      nome,
      rotulo: 'escritorio',
      plano,
      situacao: 'ativa',
      teste_iniciado_em: null,
      pago_ate: null,
      limites: {},
      criado_em: '2026-10-01T10:00:00Z',
    },
  }
}
const PERTENCA = pertenca('org-1', 'Escritório da Ana', 'administrador', 'solo')
let pertencas: MembroComOrganizacao[] = [PERTENCA]
let prazosPorOrg: Record<string, Prazo[]> = {}

vi.mock('./data/queries', () => ({
  chaves: { pertencas: (userId: string) => ['pertencas', userId] },
  cliente: vi.fn(),
  usePertencas: () => ({ data: pertencas, isPending: false, isError: false, isSuccess: true }),
  useMembros: () => vazio,
  useConvites: () => vazio,
  useConvidar: () => mutacao,
  useReenviarConvite: () => mutacao,
  useCancelarConvite: () => mutacao,
  useAlterarPapel: () => mutacao,
  useRemoverMembro: () => mutacao,
  useConfiguracaoOrganizacao: () => ({ data: undefined, isPending: true, isError: false }),
  useSalvarConfiguracaoOrganizacao: () => mutacao,
  useBuscasAgora: () => vazio,
  useRegistrarBuscaAgora: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelarBuscaAgora: () => ({ mutate: vi.fn() }),
  usePrazos: (orgId: string) => ({ ...vazio, data: prazosPorOrg[orgId] ?? [] }),
  useExecucoes: () => vazio,
  useMonitoramentos: () => vazio,
  useFeriados: () => vazio,
  useConfiguracao: () => ({ data: undefined, isPending: true, isError: false }),
  useAtualizarPrazo: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useExcluirPrazo: () => ({ mutateAsync: vi.fn() }),
  useCriarPrazo: () => ({ mutateAsync: vi.fn() }),
  useSalvarConfiguracao: () => ({ mutate: vi.fn() }),
  useTempoReal: () => {},
  useCriarFeriado: () => ({ mutate: vi.fn() }),
  useRemoverFeriado: () => ({ mutate: vi.fn() }),
  useConfiguracaoSistema: () => ({
    data: { id: 1, n8n_webhook_url: '', updated_at: '2026-10-01T10:00:00Z', updated_by: null },
    isPending: false,
    isError: false,
    isSuccess: true,
  }),
}))

const mutacao = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }
vi.mock('./data/admin', () => ({
  useContasAdmin: () => vazio,
  useOrganizacoesAdmin: () => vazio,
  useAtualizarOrganizacao: () => mutacao,
  useCriarOrganizacao: () => mutacao,
  useSalvarCarencia: () => mutacao,
  useExecucoesGlobais: () => vazio,
  useAuditoria: () => vazio,
  useMetricasAdmin: () => ({ data: undefined, isPending: true, isError: false }),
  useConfiguracaoDaConta: () => ({ data: null, isPending: false, isError: false }),
  useAcaoAdmin: () => mutacao,
  useGerarTokenAdvogado: () => mutacao,
  useDispararBusca: () => mutacao,
  useSalvarWebhookSistema: () => mutacao,
  useRegistrarAuditoria: () => mutacao,
  chamarWebhook: vi.fn(),
}))

const DEV: SessaoTeste = { user: { id: 'dev-1', email: 'root@exemplo.com', app_metadata: { app_role: 'dev' } } }
const ADVOGADA: SessaoTeste = { user: { id: 'advogada-1', email: 'ana@exemplo.com' } }

function renderizar(rota = '/prazos') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[rota]}>
            <App />
          </MemoryRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('acesso à aplicação', () => {
  beforeEach(() => {
    auth.session = null
    sessionStorage.clear()
    auth.signInWithPassword.mockReset()
    auth.signUp.mockReset()
    auth.signOut.mockReset()
  })

  it('rota protegida sem sessão leva para o login', async () => {
    renderizar('/agenda')
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('credencial errada mostra mensagem clara sem dizer se a conta existe', async () => {
    auth.signInWithPassword.mockResolvedValue({
      error: { name: 'AuthApiError', status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' },
    })
    renderizar('/login')
    await userEvent.type(await screen.findByLabelText('E-mail'), 'ana@exemplo.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'errada123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.')
  })

  it('cadastro com confirmação pendente orienta a conferir o e-mail', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: { id: 'x' } }, error: null })
    renderizar('/login')
    await userEvent.click(await screen.findByRole('button', { name: 'Criar conta' }))
    await userEvent.type(screen.getByLabelText('E-mail'), 'nova@exemplo.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'senhaforte1')
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText(/Enviamos um link de confirmação/)).toBeInTheDocument()
  })

  it('com sessão mostra o shell com as seções e o e-mail da conta', async () => {
    auth.session = { user: { id: 'advogada-1', email: 'ana@exemplo.com' } }
    renderizar('/prazos')
    expect(await screen.findByRole('heading', { name: 'Prazos' })).toBeInTheDocument()
    for (const secao of ['Prazos', 'Agenda', 'Monitoramento', 'Histórico', 'Configurações']) {
      expect(screen.getAllByRole('link', { name: secao }).length).toBeGreaterThan(0)
    }
    expect(screen.getByText('ana@exemplo.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Buscar agora/ })).toBeInTheDocument()
  })

  it('com sessão, /login e rotas desconhecidas levam para os prazos', async () => {
    auth.session = { user: { id: 'advogada-1', email: 'ana@exemplo.com' } }
    renderizar('/nao-existe')
    expect(await screen.findByRole('heading', { name: 'Prazos' })).toBeInTheDocument()
  })
})

describe('acesso dev', () => {
  beforeEach(() => {
    auth.session = null
    auth.devNoBanco = undefined
    sessionStorage.clear()
  })

  it('conta promovida com sessão antiga (sem app_role) já abre o painel', async () => {
    auth.session = { user: { id: 'dev-1', email: 'root@exemplo.com', app_metadata: {} } }
    auth.devNoBanco = true
    renderizar('/prazos')
    expect(await screen.findByRole('heading', { name: 'Visão geral' })).toBeInTheDocument()
  })

  it('dev rebaixado no banco perde o painel mesmo com sessão antiga de dev', async () => {
    auth.session = DEV
    auth.devNoBanco = false
    renderizar('/dashitecnology/usuarios')
    expect(await screen.findByRole('heading', { name: 'Prazos' })).toBeInTheDocument()
  })

  it('dev cai no painel e vê as ferramentas, inclusive o n8n', async () => {
    auth.session = DEV
    renderizar('/dashitecnology')
    expect(await screen.findByRole('heading', { name: 'Visão geral' })).toBeInTheDocument()
    for (const modo of ['Visão geral', 'Usuários', 'Dados', 'Execuções', 'n8n', 'Auditoria']) {
      expect(screen.getByRole('link', { name: modo })).toBeInTheDocument()
    }
    expect(screen.getByText(/O robô não está conectado/)).toBeInTheDocument()
  })

  it('dev sem atuação em rota de advogado volta ao painel', async () => {
    auth.session = DEV
    renderizar('/prazos')
    expect(await screen.findByRole('heading', { name: 'Visão geral' })).toBeInTheDocument()
  })

  it('modo inexistente do painel leva à visão geral', async () => {
    auth.session = DEV
    renderizar('/dashitecnology/nao-existe')
    expect(await screen.findByRole('heading', { name: 'Visão geral' })).toBeInTheDocument()
  })

  it('página do n8n é exclusiva do dev', async () => {
    auth.session = DEV
    renderizar('/dashitecnology/n8n')
    expect(await screen.findByLabelText('URL do webhook')).toBeInTheDocument()
  })

  it('advogado que tenta abrir o painel dev cai nos prazos', async () => {
    auth.session = ADVOGADA
    renderizar('/dashitecnology/usuarios')
    expect(await screen.findByRole('heading', { name: 'Prazos' })).toBeInTheDocument()
    expect(screen.queryByText('Usuários')).not.toBeInTheDocument()
  })

  it('advogado não vê o campo de URL do n8n nas configurações', async () => {
    auth.session = ADVOGADA
    renderizar('/configuracoes')
    expect(await screen.findByRole('heading', { name: 'Configurações' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/URL do webhook/)).not.toBeInTheDocument()
  })

  it('dev atuando como advogado usa as telas dele com a faixa de aviso', async () => {
    auth.session = DEV
    sessionStorage.setItem('despert:atuacao', JSON.stringify({ userId: 'advogada-1', email: 'ana@exemplo.com' }))
    renderizar('/prazos')
    expect(await screen.findByRole('heading', { name: 'Prazos' })).toBeInTheDocument()
    expect(screen.getByText(/você está atuando como/)).toHaveTextContent('ana@exemplo.com')
    expect(screen.getByRole('button', { name: 'Voltar ao painel dev' })).toBeInTheDocument()
  })

  it('atuação salva é ignorada para quem não é dev', async () => {
    auth.session = ADVOGADA
    sessionStorage.setItem('despert:atuacao', JSON.stringify({ userId: 'outra', email: 'outra@exemplo.com' }))
    renderizar('/prazos')
    expect(await screen.findByRole('heading', { name: 'Prazos' })).toBeInTheDocument()
    expect(screen.queryByText(/você está atuando como/)).not.toBeInTheDocument()
  })
})

describe('equipe e organizações', () => {
  beforeEach(() => {
    auth.session = ADVOGADA
    auth.devNoBanco = undefined
    sessionStorage.clear()
    localStorage.clear()
    pertencas = [PERTENCA]
    prazosPorOrg = {}
  })

  it('no Solo não há Equipe nem seletor de organização', async () => {
    renderizar('/equipe')
    expect(await screen.findByRole('heading', { name: 'Prazos' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Equipe' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Organização')).not.toBeInTheDocument()
  })

  it('Administrador de escritório vê e abre a Equipe', async () => {
    pertencas = [pertenca('org-1', 'Escritório da Ana', 'administrador', 'escritorio')]
    renderizar('/equipe')
    expect(await screen.findByRole('heading', { name: 'Equipe' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Equipe' }).length).toBeGreaterThan(0)
    expect(screen.getByText(/Vagas do plano:/)).toHaveTextContent('0 de 10')
  })

  it.each(['advogado', 'assistente', 'leitura'] as const)('%s não vê a Equipe e cai nos prazos', async (papel) => {
    pertencas = [pertenca('org-1', 'Escritório da Ana', papel, 'escritorio')]
    renderizar('/equipe')
    expect(await screen.findByRole('heading', { name: 'Prazos' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Equipe' })).not.toBeInTheDocument()
  })

  it.each([
    ['administrador', true],
    ['advogado', true],
    ['assistente', true],
    ['leitura', false],
  ] as const)('%s vê Prazo manual e Buscar agora: %s', async (papel, ve) => {
    pertencas = [pertenca('org-1', 'Escritório da Ana', papel, 'escritorio')]
    renderizar('/prazos')
    expect(await screen.findByRole('heading', { name: 'Prazos' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Prazo manual/ }) !== null).toBe(ve)
    expect(screen.queryByRole('button', { name: /Buscar agora/ }) !== null).toBe(ve)
  })

  it('quem está em duas organizações troca entre elas e vê só os dados da ativa', async () => {
    pertencas = [
      pertenca('org-1', 'Escritório da Ana', 'administrador', 'escritorio'),
      pertenca('org-2', 'Jurídico ACME', 'leitura', 'corporativo'),
    ]
    prazosPorOrg = {
      'org-1': [fabricarPrazo({ organizacao_id: 'org-1', processo: 'PROC-ANA' })],
      'org-2': [fabricarPrazo({ organizacao_id: 'org-2', processo: 'PROC-ACME' })],
    }
    renderizar('/prazos')
    const seletor = await screen.findByLabelText('Organização')
    expect(screen.getByText('PROC-ANA')).toBeInTheDocument()
    expect(screen.queryByText('PROC-ACME')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Prazo manual/ })).toBeInTheDocument()

    await userEvent.selectOptions(seletor, 'org-2')
    expect(await screen.findByText('PROC-ACME')).toBeInTheDocument()
    expect(screen.queryByText('PROC-ANA')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Prazo manual/ })).not.toBeInTheDocument()
    expect(localStorage.getItem('despert:organizacao:advogada-1')).toBe('org-2')
  })

  it('a organização escolhida é lembrada na próxima visita', async () => {
    pertencas = [
      pertenca('org-1', 'Escritório da Ana', 'administrador', 'escritorio'),
      pertenca('org-2', 'Jurídico ACME', 'leitura', 'corporativo'),
    ]
    prazosPorOrg = { 'org-2': [fabricarPrazo({ organizacao_id: 'org-2', processo: 'PROC-ACME' })] }
    localStorage.setItem('despert:organizacao:advogada-1', 'org-2')
    renderizar('/prazos')
    expect(await screen.findByText('PROC-ACME')).toBeInTheDocument()
    expect(screen.getByLabelText('Organização')).toHaveValue('org-2')
  })

  it('sem organização, orienta a abrir o link do convite', async () => {
    pertencas = []
    renderizar('/prazos')
    expect(await screen.findByRole('alert')).toHaveTextContent(/abra o link do e-mail/)
  })
})
