import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import Landing from './Landing'

function renderizar() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  )
}

describe('Landing', () => {
  it('apresenta a proposta e leva ao cadastro', () => {
    renderizar()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('O Diário publica.O Despert conta o prazo.')
    for (const link of screen.getAllByRole('link', { name: /Começar (teste grátis|pelo teste)/ })) {
      expect(link).toHaveAttribute('href', '/login?criar=1')
    }
    expect(screen.getAllByRole('link', { name: 'Entrar' })[0]).toHaveAttribute('href', '/login')
  })

  it('a agenda de exemplo mostra a contagem até o vencimento', () => {
    renderizar()
    expect(screen.getByText(/Vencimento em 16\/10 \(sex\)/)).toHaveTextContent(
      'sem contar 4 dias de fim de semana e o feriado de 12/10',
    )
  })

  it('trocar o prazo recalcula o vencimento', async () => {
    renderizar()
    const prazo = screen.getByRole('group', { name: 'Prazo do exemplo' })
    expect(within(prazo).getByRole('button', { name: '10' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(within(prazo).getByRole('button', { name: '5' }))
    expect(within(prazo).getByRole('button', { name: '5' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Vencimento em 08\/10 \(qui\)/)).toBeInTheDocument()
  })

  it('mostra os preços mensais dos três planos', () => {
    renderizar()
    for (const preco of ['R$ 79,90', 'R$ 397,90', 'R$ 849,90']) {
      expect(screen.getAllByText(preco).length).toBeGreaterThan(0)
    }
    expect(screen.getByText('Mais de 20 usuários: preço combinado caso a caso.')).toBeInTheDocument()
  })

  it('não inventa provas: exemplos vêm rotulados', () => {
    renderizar()
    expect(screen.getByText('Publicação de exemplo')).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Resumo diário de exemplo' })).toBeInTheDocument()
  })
})
