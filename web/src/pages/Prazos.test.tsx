import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Prazo } from '../lib/database.types'
import type { ContextoLayout } from '../lib/layout-context'
import { fabricarPrazo } from '../test/fabricas'
import Prazos from './Prazos'

const HOJE = '2026-10-06'
let prazos: Prazo[] = []
const mutate = vi.fn()

vi.mock('../lib/auth-context', () => ({
  useUserId: () => 'advogada-1',
}))

vi.mock('../data/queries', () => ({
  usePrazos: () => ({ data: prazos, isPending: false, isError: false, isSuccess: true }),
  useMonitoramentos: () => ({ data: [], isPending: false, isSuccess: true }),
  useConfiguracaoSistema: () => ({ data: { n8n_webhook_url: '' }, isPending: false }),
  useAtualizarPrazo: () => ({ mutate, isPending: false }),
}))

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
})
