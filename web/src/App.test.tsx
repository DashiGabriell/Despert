import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import AuthProvider from './components/AuthProvider'
import ToastProvider from './components/ToastProvider'

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
const PERTENCA = {
  organizacao_id: 'org-1',
  user_id: 'advogada-1',
  papel: 'administrador',
  criado_em: '2026-10-01T10:00:00Z',
  organizacao: {
    id: 'org-1',
    nome: 'Escritório da Ana',
    rotulo: 'escritorio',
    plano: 'solo',
    situacao: 'ativa',
    teste_iniciado_em: null,
    pago_ate: null,
    limites: {},
    criado_em: '2026-10-01T10:00:00Z',
  },
}
vi.mock('./data/queries', () => ({
  usePertencas: () => ({ data: [PERTENCA], isPending: false, isError: false, isSuccess: true }),
  useMembros: () => vazio,
  useBuscasAgora: () => vazio,
  useRegistrarBuscaAgora: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelarBuscaAgora: () => ({ mutate: vi.fn() }),
  usePrazos: () => vazio,
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
