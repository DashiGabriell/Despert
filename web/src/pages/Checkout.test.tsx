import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PapelMembro, Plano } from '../lib/database.types'
import Checkout from './Checkout'

let papel: PapelMembro = 'administrador'
let plano: Plano = 'solo'
let atuacao: { email: string } | null = null
const { contratar, abrirPagamento } = vi.hoisted(() => ({
  contratar: vi.fn(),
  abrirPagamento: vi.fn(),
}))

vi.mock('../lib/organizacao-context', () => ({
  usePertenca: () => ({
    papel,
    organizacao: { id: 'org-1', plano },
  }),
}))
vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ atuacao }),
}))
vi.mock('../data/checkout', () => ({
  useContratar: () => ({ mutateAsync: contratar, isPending: false }),
  abrirPagamento,
}))

function renderizar() {
  return render(
    <MemoryRouter>
      <Checkout />
    </MemoryRouter>,
  )
}

describe('Checkout', () => {
  beforeEach(() => {
    papel = 'administrador'
    plano = 'solo'
    atuacao = null
    contratar.mockReset()
    abrirPagamento.mockReset()
    contratar.mockResolvedValue('https://sandbox.asaas.com/checkoutSession/show/abc')
  })

  it('mostra os três preços e abre o pagamento do plano escolhido', async () => {
    renderizar()
    expect(screen.getByRole('heading', { name: 'Solo' })).toBeInTheDocument()
    expect(screen.getByText('R$ 79,90')).toBeInTheDocument()
    expect(screen.getByText('R$ 397,90')).toBeInTheDocument()
    expect(screen.getByText('R$ 849,90')).toBeInTheDocument()
    expect(screen.getByText('Plano atual')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Pagar R$ 397,90' }))
    expect(contratar).toHaveBeenCalledWith({ organizacaoId: 'org-1', plano: 'escritorio' })
    expect(abrirPagamento).toHaveBeenCalledWith('https://sandbox.asaas.com/checkoutSession/show/abc')
  })

  it('avisa ao trocar para um plano menor', () => {
    plano = 'escritorio'
    renderizar()
    expect(screen.getByText(/Plano menor: nada é apagado/)).toBeInTheDocument()
  })

  it('não oferece pagamento a quem não é Administrador', () => {
    papel = 'advogado'
    renderizar()
    expect(screen.queryByRole('button', { name: /Pagar/ })).not.toBeInTheDocument()
    expect(screen.getByText('Só o Administrador da organização contrata o plano.')).toBeInTheDocument()
  })
})
