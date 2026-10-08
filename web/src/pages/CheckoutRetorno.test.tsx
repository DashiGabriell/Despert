import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import CheckoutRetorno from './CheckoutRetorno'

function renderizar(entrada: string) {
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <CheckoutRetorno />
    </MemoryRouter>,
  )
}

describe('retorno do checkout', () => {
  it('não trata o redirecionamento como pagamento confirmado', () => {
    renderizar('/checkout/retorno?resultado=pago')
    expect(screen.getByRole('heading', { name: 'Pagamento enviado' })).toBeInTheDocument()
    expect(screen.getByText(/quando o Asaas confirmar/)).toBeInTheDocument()
  })

  it('explica cancelamento e link expirado', () => {
    const { unmount } = renderizar('/checkout/retorno?resultado=cancelado')
    expect(screen.getByRole('heading', { name: 'Pagamento cancelado' })).toBeInTheDocument()
    unmount()
    renderizar('/checkout/retorno?resultado=expirado')
    expect(screen.getByRole('heading', { name: 'Link expirado' })).toBeInTheDocument()
  })

  it('ignora um resultado fora dos três', () => {
    renderizar('/checkout/retorno?resultado=confirmado')
    expect(screen.getByRole('heading', { name: 'Retorno não reconhecido' })).toBeInTheDocument()
  })
})
