import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'

function renderizar(rota = '/prazos') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <App />
    </MemoryRouter>,
  )
}

describe('aplicação', () => {
  it('mostra o shell com as seções navegáveis', () => {
    renderizar()
    expect(screen.getByText('Despert')).toBeInTheDocument()
    for (const secao of ['Prazos', 'Agenda', 'Monitoramento', 'Histórico', 'Configurações']) {
      expect(screen.getAllByRole('link', { name: secao }).length).toBeGreaterThan(0)
    }
  })

  it('troca de seção conforme a rota', () => {
    renderizar('/agenda')
    expect(screen.getByRole('heading', { name: 'Agenda' })).toBeInTheDocument()
    expect(screen.getByText(/Grade mensal/)).toBeInTheDocument()
  })

  it('redireciona rota desconhecida para os prazos', () => {
    renderizar('/nao-existe')
    expect(screen.getByRole('heading', { name: 'Prazos' })).toBeInTheDocument()
  })
})
