import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pode } from '../domain/permissoes'
import { LIMITES_PADRAO, type Limites } from '../domain/planos'
import type { MembroDaEquipe, PapelMembro, Prazo } from '../lib/database.types'
import type { ContextoLayout } from '../lib/layout-context'
import { fabricarPrazo } from '../test/fabricas'
import Prazos from './Prazos'

const HOJE = '2026-10-06'
let prazos: Prazo[] = []
let membros: MembroDaEquipe[] = []
let papel: PapelMembro = 'administrador'
const mutate = vi.fn()

vi.mock('../lib/auth-context', () => ({
  useUserId: () => 'advogada-1',
}))

vi.mock('../lib/organizacao-context', () => ({
  useOrganizacaoId: () => 'org-1',
  usePode: () => (acao: Parameters<typeof pode>[1]) => pode(papel, acao),
}))

let limites: Limites = LIMITES_PADRAO.solo
const exportar = vi.fn()
const baixar = vi.fn()

vi.mock('../data/plano', () => ({ usePlano: () => ({ escrita: true, limites }) }))

vi.mock('../data/queries', () => ({
  usePrazos: () => ({ data: prazos, isPending: false, isError: false, isSuccess: true }),
  useMonitoramentos: () => ({ data: [], isPending: false, isSuccess: true }),
  useConfiguracaoSistema: () => ({ data: { n8n_webhook_url: '' }, isPending: false }),
  useAtualizarPrazo: () => ({ mutate, isPending: false }),
  useMembros: () => ({ data: membros, isPending: false, isSuccess: true }),
  useExportarPrazos: () => ({ mutate: exportar, isPending: false }),
}))

vi.mock('../lib/download', () => ({ baixarArquivo: (...args: unknown[]) => baixar(...args) }))

const EQUIPE: MembroDaEquipe[] = [
  { user_id: 'advogada-1', email: 'ana@exemplo.com', papel: 'administrador', criado_em: '' },
  { user_id: 'bruno-1', email: 'bruno@exemplo.com', papel: 'advogado', criado_em: '' },
]

function renderizar() {
  const contexto: ContextoLayout = { hoje: HOJE, abrirPrazo: vi.fn(), novoPrazo: vi.fn() }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Routes>
          <Route element={<Outlet context={contexto} />}>
            <Route path="/" element={<Prazos />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return contexto
}

function processosNaTabela() {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((linha) => within(linha).queryByText(/^PROC-/)?.textContent ?? within(linha).getByRole('cell').textContent)
}

describe('tela de Prazos', () => {
  beforeEach(() => {
    mutate.mockReset()
    exportar.mockReset()
    baixar.mockReset()
    membros = []
    papel = 'administrador'
    limites = LIMITES_PADRAO.solo
    prazos = [
      fabricarPrazo({ processo: 'PROC-VENCIDO', vencimento: '2026-10-01' }),
      fabricarPrazo({ processo: 'PROC-HOJE', vencimento: HOJE }),
      fabricarPrazo({ processo: 'PROC-SEMANA', vencimento: '2026-10-09', partes: 'BANCO XPTO' }),
      fabricarPrazo({ processo: 'PROC-CONFERIR', vencimento: '2026-11-20', status: 'conferir' }),
      fabricarPrazo({ processo: 'PROC-CUMPRIDO', vencimento: '2026-10-02', status: 'cumprido' }),
    ]
  })

  it('mostra os cinco indicadores contados sobre os prazos em aberto', () => {
    renderizar()
    const valor = (rotulo: string) =>
      screen.getByRole('button', { name: new RegExp(rotulo) }).querySelector('strong')?.textContent
    expect(valor('Vencidos')).toBe('1')
    expect(valor('Vencem hoje')).toBe('1')
    expect(valor('Próximos 7 dias')).toBe('2')
    expect(valor('Para conferir')).toBe('1')
    expect(valor('Em aberto')).toBe('4')
    expect(screen.getByText('4 prazos')).toBeInTheDocument()
  })

  it('clicar no indicador filtra e destaca; clicar de novo limpa', async () => {
    renderizar()
    const vencidos = screen.getByRole('button', { name: /Vencidos/ })
    await userEvent.click(vencidos)
    expect(vencidos).toHaveAttribute('aria-pressed', 'true')
    expect(processosNaTabela()).toEqual(['PROC-VENCIDO'])
    expect(screen.getByText('1 prazo')).toBeInTheDocument()

    await userEvent.click(vencidos)
    expect(vencidos).toHaveAttribute('aria-pressed', 'false')
    expect(processosNaTabela()).toHaveLength(4)
  })

  it('combina filtro de status com busca textual e permite limpar', async () => {
    renderizar()
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por status'), 'todos')
    expect(processosNaTabela()).toHaveLength(5)

    await userEvent.type(screen.getByLabelText('Buscar prazos'), 'xpto')
    expect(processosNaTabela()).toEqual(['PROC-SEMANA'])

    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(processosNaTabela()).toHaveLength(4)
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument()
  })

  it('sem filtros que casem, avisa; sem nenhum prazo, guia a primeira utilização', async () => {
    renderizar()
    await userEvent.type(screen.getByLabelText('Buscar prazos'), 'nada disso')
    expect(screen.getByText('Nenhum prazo com esses filtros.')).toBeInTheDocument()
  })

  it('com a lista vazia mostra o guia de primeiros passos', () => {
    prazos = []
    renderizar()
    expect(screen.getByText('Nenhuma publicação capturada ainda')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Monitoramento' })).toHaveAttribute('href', '/monitoramento')
    expect(screen.getByText(/Aguarde o administrador do sistema conectar o robô/)).toBeInTheDocument()
  })

  it('marcar cumprido pela lista grava status e data', async () => {
    renderizar()
    const linha = screen.getByText('PROC-HOJE').closest('tr')!
    await userEvent.click(within(linha).getByRole('button', { name: 'Cumprido' }))
    expect(mutate).toHaveBeenCalledWith(
      { id: prazos[1].id, dados: { status: 'cumprido', cumprido_em: expect.any(String) } },
      expect.anything(),
    )
  })

  it('no Solo não mostra filtro nem coluna de responsável', () => {
    renderizar()
    expect(screen.queryByLabelText('Filtrar por responsável')).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Responsável' })).not.toBeInTheDocument()
  })

  it('em equipe começa em "Meus prazos" e mostra os da equipe sob pedido', async () => {
    membros = EQUIPE
    prazos.push(
      fabricarPrazo({ processo: 'PROC-BRUNO', vencimento: '2026-10-08', responsavel_id: 'bruno-1' }),
      fabricarPrazo({ processo: 'PROC-SEM-DONO', vencimento: '2026-10-08', responsavel_id: null }),
    )
    renderizar()
    const filtro = screen.getByLabelText('Filtrar por responsável')
    expect(filtro).toHaveDisplayValue('Meus prazos')
    expect(processosNaTabela()).toHaveLength(4)
    expect(screen.getByRole('columnheader', { name: 'Responsável' })).toBeInTheDocument()

    await userEvent.selectOptions(filtro, 'todos')
    expect(processosNaTabela()).toHaveLength(6)
    expect(within(screen.getByText('PROC-SEM-DONO').closest('tr')!).getByRole('cell', { name: '—' })).toBeInTheDocument()

    await userEvent.selectOptions(filtro, 'bruno-1')
    expect(processosNaTabela()).toEqual(['PROC-BRUNO'])
    expect(within(screen.getByText('PROC-BRUNO').closest('tr')!).getByRole('cell', { name: 'bruno' })).toBeInTheDocument()
  })

  it('sem prazos próprios em equipe, orienta a ver os da equipe', () => {
    membros = EQUIPE
    prazos = [fabricarPrazo({ processo: 'PROC-BRUNO', responsavel_id: 'bruno-1' })]
    renderizar()
    expect(screen.getByText(/Nenhum prazo sob sua responsabilidade/)).toBeInTheDocument()
  })

  it.each([
    ['administrador', true],
    ['advogado', true],
    ['assistente', true],
    ['leitura', false],
  ] as const)('%s vê o botão Cumprido na lista: %s', (p, ve) => {
    papel = p
    renderizar()
    const linha = screen.getByText('PROC-HOJE').closest('tr')!
    expect(within(linha).queryByRole('button', { name: 'Cumprido' }) !== null).toBe(ve)
  })

  it.each([
    ['administrador', true],
    ['advogado', true],
    ['assistente', false],
    ['leitura', true],
  ] as const)('no Escritório, %s vê Exportar CSV: %s', (p, ve) => {
    papel = p
    limites = LIMITES_PADRAO.escritorio
    renderizar()
    expect(screen.queryByRole('button', { name: 'Exportar CSV' }) !== null).toBe(ve)
  })

  it('no Solo não há exportação', () => {
    renderizar()
    expect(screen.queryByRole('button', { name: 'Exportar CSV' })).not.toBeInTheDocument()
  })

  it('exporta o que o banco devolve com os filtros da tela', async () => {
    limites = LIMITES_PADRAO.escritorio
    membros = EQUIPE
    exportar.mockImplementation((_vars, opcoes) => opcoes.onSuccess(prazos))
    renderizar()
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por responsável'), 'todos')
    await userEvent.type(screen.getByLabelText('Buscar prazos'), 'xpto')
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    expect(baixar).toHaveBeenCalledTimes(1)
    const [nome, csv] = baixar.mock.calls[0] as [string, string]
    expect(nome).toBe(`prazos-${HOJE}.csv`)
    const linhas = csv.replace('\uFEFF', '').trimEnd().split('\r\n')
    expect(linhas).toHaveLength(2)
    expect(linhas[1]).toMatch(/^PROC-SEMANA;/)
    expect(linhas[1]).toContain(';ana@exemplo.com;')
  })
})
