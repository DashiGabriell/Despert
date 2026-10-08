import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Periodo } from '../data/queries'
import { pode } from '../domain/permissoes'
import { LIMITES_PADRAO, type Limites } from '../domain/planos'
import type { MembroDaEquipe, PapelMembro, RegistroAuditoria } from '../lib/database.types'
import { fabricarRegistro } from '../test/fabricas'
import Auditoria from './Auditoria'

let papel: PapelMembro = 'administrador'
let limites: Limites = LIMITES_PADRAO.escritorio
let registros: RegistroAuditoria[] = []
let carregando = false
const periodos: Periodo[] = []
const exportar = vi.fn()
const baixar = vi.fn()

const EQUIPE: MembroDaEquipe[] = [
  { user_id: 'ana-1', email: 'ana@exemplo.com', papel: 'administrador', criado_em: '' },
  { user_id: 'bruno-1', email: 'bruno@exemplo.com', papel: 'advogado', criado_em: '' },
]

vi.mock('../lib/organizacao-context', () => ({
  useOrganizacaoId: () => 'org-1',
  usePode: () => (acao: Parameters<typeof pode>[1]) => pode(papel, acao),
}))
vi.mock('../data/plano', () => ({ usePlano: () => ({ limites, escrita: true }) }))
vi.mock('../data/relogio', () => ({ useHoje: () => '2026-10-06' }))
vi.mock('../lib/toast-context', () => ({ useToast: () => vi.fn(), mensagemDeErro: (e: { message: string }) => e.message }))
vi.mock('../lib/download', () => ({ baixarArquivo: (...args: unknown[]) => baixar(...args) }))
vi.mock('../data/queries', () => ({
  useMembros: () => ({ data: EQUIPE, isPending: false, isSuccess: true }),
  useAuditoriaDaOrganizacao: (_org: string, periodo: Periodo) => {
    periodos.push(periodo)
    return carregando
      ? { data: undefined, isPending: true, isSuccess: false, isError: false }
      : { data: registros, isPending: false, isSuccess: true, isError: false }
  },
  useExportarAuditoria: () => ({ mutate: exportar, isPending: false }),
}))

function renderizar() {
  render(
    <MemoryRouter initialEntries={['/auditoria']}>
      <Routes>
        <Route path="/auditoria" element={<Auditoria />} />
        <Route path="/prazos" element={<h1>Prazos</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

function linhas() {
  return screen.getAllByRole('row').slice(1)
}

describe('tela Auditoria', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    papel = 'administrador'
    limites = LIMITES_PADRAO.escritorio
    carregando = false
    periodos.length = 0
    registros = [
      fabricarRegistro({
        acao: 'update:prazos',
        detalhe: { processo: '0801234' },
        antes: { status: 'pendente' },
        depois: { status: 'cumprido' },
      }),
      fabricarRegistro({
        membro_id: 'ana-1',
        membro_email: 'ana@exemplo.com',
        acao: 'insert:convites',
        detalhe: { email: 'carla@exemplo.com', papel: 'leitura' },
        depois: { papel: 'leitura' },
      }),
      fabricarRegistro({ membro_id: null, membro_email: null, dev_id: 'dev-1', acao: 'atuar_como' }),
    ]
  })

  it.each(['advogado', 'assistente', 'leitura'] as const)('%s é levado de volta aos prazos', (p) => {
    papel = p
    renderizar()
    expect(screen.getByRole('heading', { name: 'Prazos' })).toBeInTheDocument()
  })

  it('no plano sem auditoria (Solo) nem o Administrador abre', () => {
    limites = LIMITES_PADRAO.solo
    renderizar()
    expect(screen.getByRole('heading', { name: 'Prazos' })).toBeInTheDocument()
  })

  it('lista ações da equipe e do suporte com as alterações legíveis', () => {
    renderizar()
    expect(linhas()).toHaveLength(3)
    expect(screen.getByText('processo 0801234 · status: Pendente → Cumprido')).toBeInTheDocument()
    expect(screen.getByText('carla@exemplo.com · Leitura')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Suporte Despert' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Entrou como advogado' })).toBeInTheDocument()
  })

  it('consulta os últimos 30 dias e muda o período pelo filtro', async () => {
    renderizar()
    expect(periodos.at(-1)).toEqual({ de: '2026-09-06T00:00:00-03:00', ate: '2026-10-07T03:00:00.000Z' })
    const de = screen.getByLabelText('De')
    await userEvent.clear(de)
    await userEvent.type(de, '2026-10-01')
    expect(periodos.at(-1)?.de).toBe('2026-10-01T00:00:00-03:00')
  })

  it('filtra por autor (inclusive o suporte) e por tipo', async () => {
    renderizar()
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por autor'), 'suporte')
    expect(linhas()).toHaveLength(1)
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por autor'), 'bruno-1')
    expect(linhas()).toHaveLength(1)
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por tipo'), 'equipe')
    expect(screen.getByText('Nenhum registro nesse período com esses filtros.')).toBeInTheDocument()
  })

  it('exporta pelo banco no período e com os filtros da tela', async () => {
    exportar.mockImplementation((_periodo, opcoes) => opcoes.onSuccess(registros))
    renderizar()
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por tipo'), 'prazos')
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    expect(exportar).toHaveBeenCalledWith(
      { de: '2026-09-06T00:00:00-03:00', ate: '2026-10-07T03:00:00.000Z' },
      expect.anything(),
    )
    const [nome, csv] = baixar.mock.calls[0] as [string, string]
    expect(nome).toBe('auditoria-2026-10-06.csv')
    const conteudo = csv.replace('\uFEFF', '').trimEnd().split('\r\n')
    expect(conteudo).toHaveLength(2)
    expect(conteudo[1]).toContain(';bruno@exemplo.com;Alterou prazo;')
  })

  it('avisa quando a data inicial passa da final e trava a exportação', async () => {
    renderizar()
    const de = screen.getByLabelText('De')
    await userEvent.clear(de)
    await userEvent.type(de, '2026-10-20')
    expect(screen.getByText('A data inicial é depois da final.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled()
  })
})
