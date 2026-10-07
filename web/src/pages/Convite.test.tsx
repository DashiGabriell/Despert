import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResumoConvite } from '../lib/database.types'
import Convite from './Convite'

type Sessao = { user: { id: string; email: string } } | null

const estado = vi.hoisted(() => ({
  sessao: null as Sessao,
  resumo: null as ResumoConvite | null,
  rpc: vi.fn(),
  sair: vi.fn(),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
}))

vi.mock('../lib/auth-context', () => ({ useAuth: () => ({ sessao: estado.sessao, sair: estado.sair }) }))
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signUp: estado.signUp, signInWithPassword: estado.signInWithPassword } },
}))
vi.mock('../data/queries', () => ({
  chaves: { pertencas: (userId: string) => ['pertencas', userId] },
  cliente: () => ({ rpc: estado.rpc }),
}))

const PENDENTE: ResumoConvite = {
  organizacao: 'Escritório da Ana',
  papel: 'assistente',
  email: 'carla@exemplo.com',
  situacao: 'pendente',
}

function renderizar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/convite/tok-123']}>
        <Routes>
          <Route path="/convite/:token" element={<Convite />} />
          <Route path="/prazos" element={<h1>Prazos</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('página do convite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    estado.sessao = null
    estado.resumo = PENDENTE
    estado.rpc.mockImplementation(async (funcao: string) =>
      funcao === 'ver_convite'
        ? { data: estado.resumo ? [estado.resumo] : [], error: null }
        : { data: 'org-9', error: null },
    )
  })

  it('sem conta, mostra o convite e cria a conta com o e-mail convidado', async () => {
    estado.signUp.mockResolvedValue({ data: { session: null }, error: null })
    renderizar()
    expect(await screen.findByRole('heading', { name: 'Convite para Escritório da Ana' })).toBeInTheDocument()
    expect(screen.getByText('Assistente')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Crie uma senha'), 'senhaforte1')
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(estado.signUp).toHaveBeenCalledWith({
      email: 'carla@exemplo.com',
      password: 'senhaforte1',
      options: { emailRedirectTo: `${window.location.origin}/convite/tok-123` },
    })
    expect(await screen.findByText(/Confirme pelo link/)).toBeInTheDocument()
  })

  it('quem já tem conta entra com a senha', async () => {
    estado.signInWithPassword.mockResolvedValue({ error: null })
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Já tenho conta' }))
    await userEvent.type(screen.getByLabelText('Sua senha'), 'qualquer1')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(estado.signInWithPassword).toHaveBeenCalledWith({ email: 'carla@exemplo.com', password: 'qualquer1' })
  })

  it('logado com o e-mail certo, aceita, lembra a organização e vai aos prazos', async () => {
    estado.sessao = { user: { id: 'carla-1', email: 'Carla@Exemplo.com' } }
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Aceitar convite' }))
    expect(estado.rpc).toHaveBeenCalledWith('aceitar_convite', { codigo: 'tok-123' })
    expect(await screen.findByRole('heading', { name: 'Prazos' })).toBeInTheDocument()
    expect(localStorage.getItem('despert:organizacao:carla-1')).toBe('org-9')
  })

  it('logado com outro e-mail, explica e oferece sair', async () => {
    estado.sessao = { user: { id: 'ana-1', email: 'ana@exemplo.com' } }
    renderizar()
    expect(await screen.findByText(/Você está conectado\(a\) como/)).toHaveTextContent('ana@exemplo.com')
    expect(screen.queryByRole('button', { name: 'Aceitar convite' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(estado.sair).toHaveBeenCalled()
  })

  it('mostra a recusa do banco ao aceitar (ex.: limite de usuários)', async () => {
    estado.sessao = { user: { id: 'carla-1', email: 'carla@exemplo.com' } }
    estado.rpc.mockImplementation(async (funcao: string) =>
      funcao === 'ver_convite'
        ? { data: [PENDENTE], error: null }
        : { data: null, error: { message: 'Limite de usuários atingido (10).' } },
    )
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Aceitar convite' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Limite de usuários atingido (10).')
  })

  it.each([
    ['expirado', 'Convite expirado'],
    ['aceito', 'Convite já usado'],
  ] as const)('convite %s não pode ser aceito', async (situacao, titulo) => {
    estado.resumo = { ...PENDENTE, situacao }
    estado.sessao = { user: { id: 'carla-1', email: 'carla@exemplo.com' } }
    renderizar()
    expect(await screen.findByRole('heading', { name: titulo })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aceitar convite' })).not.toBeInTheDocument()
  })

  it('link desconhecido avisa que o convite não existe', async () => {
    estado.resumo = null
    renderizar()
    expect(await screen.findByRole('heading', { name: 'Convite não encontrado' })).toBeInTheDocument()
  })
})
