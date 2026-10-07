import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import AuthProvider from './components/AuthProvider'
import ToastProvider from './components/ToastProvider'

const auth = vi.hoisted(() => ({
  session: null as null | { user: { id: string; email: string } },
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('./lib/supabase', () => ({
  supabaseConfigurado: true,
  ausenciaConfiguracao: null,
  supabase: {
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
vi.mock('./data/queries', () => ({
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
}))

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
