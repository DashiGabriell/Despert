import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pode } from '../domain/permissoes'
import { LIMITES_PADRAO, type Limites } from '../domain/planos'
import type { Convite, MembroDaEquipe, PapelMembro } from '../lib/database.types'
import Equipe from './Equipe'

let papel: PapelMembro = 'administrador'
let limites: Limites = LIMITES_PADRAO.escritorio
let escrita = true
let membros: MembroDaEquipe[] = []
let convites: Convite[] = []
const convidar = vi.fn()
const alterarPapel = vi.fn()
const remover = vi.fn()
const reenviar = vi.fn()
const cancelar = vi.fn()

vi.mock('../lib/auth-context', () => ({ useUserId: () => 'ana-1' }))
vi.mock('../lib/organizacao-context', () => ({
  useOrganizacaoId: () => 'org-1',
  usePertenca: () => ({ organizacao_id: 'org-1', papel, organizacao: { nome: 'Escritório da Ana' } }),
  usePode: () => (acao: Parameters<typeof pode>[1]) => pode(papel, acao),
}))
vi.mock('../data/plano', () => ({ usePlano: () => ({ limites, escrita }) }))
vi.mock('../data/queries', () => ({
  useMembros: () => ({ data: membros, isPending: false, isError: false }),
  useConvites: () => ({ data: convites, isPending: false, isError: false, isSuccess: true }),
  useConvidar: () => ({ mutate: convidar, isPending: false }),
  useReenviarConvite: () => ({ mutate: reenviar, isPending: false }),
  useCancelarConvite: () => ({ mutate: cancelar, isPending: false }),
  useAlterarPapel: () => ({ mutate: alterarPapel, isPending: false }),
  useRemoverMembro: () => ({ mutate: remover, isPending: false }),
}))

const AGORA = Date.now()
const em = (dias: number) => new Date(AGORA + dias * 86_400_000).toISOString()

function convite(parcial: Partial<Convite>): Convite {
  return {
    id: parcial.email ?? 'c',
    organizacao_id: 'org-1',
    email: 'nova@exemplo.com',
    papel: 'advogado',
    token: 'tok-123',
    criado_por: 'ana-1',
    criado_em: em(-1),
    expira_em: em(6),
    aceito_em: null,
    enviado_em: null,
    ...parcial,
  }
}

function renderizar() {
  render(
    <MemoryRouter initialEntries={['/equipe']}>
      <Routes>
        <Route path="/equipe" element={<Equipe />} />
        <Route path="/prazos" element={<h1>Prazos</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('tela Equipe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    papel = 'administrador'
    limites = LIMITES_PADRAO.escritorio
    escrita = true
    membros = [
      { user_id: 'ana-1', email: 'ana@exemplo.com', papel: 'administrador', criado_em: '2026-10-01T10:00:00Z' },
      { user_id: 'bruno-1', email: 'bruno@exemplo.com', papel: 'advogado', criado_em: '2026-10-02T10:00:00Z' },
    ]
    convites = [convite({ email: 'carla@exemplo.com', papel: 'assistente' })]
  })

  it.each(['advogado', 'assistente', 'leitura'] as const)('%s é levado de volta aos prazos', (p) => {
    papel = p
    renderizar()
    expect(screen.getByRole('heading', { name: 'Prazos' })).toBeInTheDocument()
  })

  it('no plano sem papéis (Solo) nem o Administrador abre a Equipe', () => {
    limites = LIMITES_PADRAO.solo
    renderizar()
    expect(screen.getByRole('heading', { name: 'Prazos' })).toBeInTheDocument()
  })

  it('mostra as vagas contando membros e convites pendentes', () => {
    convites.push(convite({ email: 'velho@exemplo.com', expira_em: em(-1) }))
    renderizar()
    expect(screen.getByText(/Vagas do plano:/)).toHaveTextContent('3 de 10')
    expect(screen.getByText('Expirado')).toBeInTheDocument()
  })

  it('mostra se o e-mail do convite já saiu', () => {
    convites = [convite({ email: 'fila@exemplo.com' }), convite({ email: 'foi@exemplo.com', enviado_em: em(0) })]
    renderizar()
    expect(screen.getByText('E-mail na fila')).toBeInTheDocument()
    expect(screen.getByText(/^E-mail enviado em/)).toBeInTheDocument()
  })

  it('cria o convite e oferece copiar o link ou enviar por e-mail', async () => {
    convidar.mockImplementation((_dados, opcoes) => opcoes.onSuccess(convite({ email: 'davi@exemplo.com' })))
    renderizar()
    await userEvent.type(screen.getByLabelText('E-mail'), 'Davi@Exemplo.com')
    await userEvent.selectOptions(screen.getByLabelText('Papel'), 'leitura')
    await userEvent.click(screen.getByRole('button', { name: 'Criar convite' }))
    expect(convidar).toHaveBeenCalledWith({ email: 'davi@exemplo.com', papel: 'leitura' }, expect.anything())
    expect(screen.getByText(/Convite criado para/)).toHaveTextContent('davi@exemplo.com')
    const enviar = screen.getAllByRole('link', { name: 'Enviar por e-mail' })[0]
    expect(enviar.getAttribute('href')).toMatch(/^mailto:davi%40exemplo\.com\?/)
    expect(decodeURIComponent(enviar.getAttribute('href')!)).toContain('/convite/tok-123')
  })

  it('recusa convite repetido ou para quem já é membro, sem chamar o banco', async () => {
    renderizar()
    await userEvent.type(screen.getByLabelText('E-mail'), 'bruno@exemplo.com')
    await userEvent.click(screen.getByRole('button', { name: 'Criar convite' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/já faz parte da equipe/)
    expect(convidar).not.toHaveBeenCalled()
  })

  it('mostra a recusa do banco acima do limite de usuários', async () => {
    convidar.mockImplementation((_dados, opcoes) =>
      opcoes.onError({
        message: 'Limite de usuários atingido (10): equipe e convites pendentes já ocupam todas as vagas do plano.',
      }),
    )
    renderizar()
    await userEvent.type(screen.getByLabelText('E-mail'), 'extra@exemplo.com')
    await userEvent.click(screen.getByRole('button', { name: 'Criar convite' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Limite de usuários atingido (10)')
  })

  it('com todas as vagas ocupadas, avisa e trava o convite', () => {
    limites = { ...LIMITES_PADRAO.escritorio, usuarios: 3 }
    renderizar()
    expect(screen.getByText(/Todas as vagas do plano estão ocupadas/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Criar convite' })).toBeDisabled()
  })

  it('troca o papel de outro membro avisando que a OAB será pausada', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderizar()
    expect(screen.queryByLabelText('Papel de ana@exemplo.com')).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Papel de bruno@exemplo.com'), 'assistente')
    expect(confirmar).toHaveBeenCalledWith(expect.stringMatching(/OAB monitorada dessa pessoa será pausada/))
    expect(alterarPapel).toHaveBeenCalledWith({ membro: 'bruno-1', papel: 'assistente' }, expect.anything())
    confirmar.mockRestore()
  })

  it('remove um membro após confirmar; a própria linha não tem Remover', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderizar()
    const linhaAna = screen.getByText('ana@exemplo.com').closest('tr')!
    expect(within(linhaAna).queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument()
    const linhaBruno = screen.getByText('bruno@exemplo.com').closest('tr')!
    await userEvent.click(within(linhaBruno).getByRole('button', { name: 'Remover' }))
    expect(confirmar).toHaveBeenCalledWith(expect.stringMatching(/em aberto passam para você/))
    expect(remover).toHaveBeenCalledWith('bruno-1', expect.anything())
    confirmar.mockRestore()
  })

  it('reenvia e cancela convites', async () => {
    renderizar()
    const linha = screen.getByText('carla@exemplo.com').closest('tr')!
    await userEvent.click(within(linha).getByRole('button', { name: 'Reenviar' }))
    await userEvent.click(within(linha).getByRole('button', { name: 'Cancelar' }))
    expect(reenviar).toHaveBeenCalledWith('carla@exemplo.com', expect.anything())
    expect(cancelar).toHaveBeenCalledWith('carla@exemplo.com', expect.anything())
  })

  it('em somente leitura não deixa alterar a equipe', () => {
    escrita = false
    renderizar()
    expect(screen.getByText(/somente leitura/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Criar convite' })).toBeDisabled()
    expect(screen.getByLabelText('Papel de bruno@exemplo.com')).toBeDisabled()
  })
})
