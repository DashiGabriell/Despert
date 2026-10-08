import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { BarraAbas, FolhaApp, LinkFolha } from './NavegacaoApp'

const ABAS = [
  { to: '/prazos', rotulo: 'Prazos', d: 'M0 0', contador: 3 },
  { to: '/agenda', rotulo: 'Agenda', d: 'M0 0' },
  { to: '/monitoramento', rotulo: 'Monitorar', rotuloCompleto: 'Monitoramento', d: 'M0 0' },
]

function Casco({ onNovo = () => undefined }: { onNovo?: () => void }) {
  const [aberta, setAberta] = useState(false)
  return (
    <MemoryRouter initialEntries={['/agenda']}>
      <BarraAbas
        rotulo="Navegação principal"
        abas={ABAS}
        acao={{ rotulo: 'Novo prazo', d: 'M0 0', onClick: onNovo }}
        maisAberta={aberta}
        maisAtiva={false}
        onMais={() => setAberta(true)}
      />
      <FolhaApp aberta={aberta} onFechar={() => setAberta(false)} titulo="Escritório Ana">
        <LinkFolha to="/historico" rotulo="Histórico" d="M0 0" onClick={() => setAberta(false)} />
      </FolhaApp>
    </MemoryRouter>
  )
}

describe('BarraAbas', () => {
  it('põe a ação no centro, marca a aba atual e mostra os críticos', () => {
    render(<Casco />)
    const barra = screen.getByRole('navigation', { name: 'Navegação principal' })
    const itens = Array.from(barra.children)
    expect(itens.map((i) => i.textContent)).toEqual(['Prazos3', 'Agenda', 'Novo prazo', 'Monitorar', 'Mais'])
    expect(within(barra).getByRole('link', { name: 'Agenda' })).toHaveAttribute('aria-current', 'page')
    expect(within(barra).getByRole('link', { name: 'Monitoramento' })).toHaveAttribute('href', '/monitoramento')
    expect(within(barra).getByLabelText('3 críticos')).toBeInTheDocument()
  })

  it('a ação central dispara o novo prazo', async () => {
    const onNovo = vi.fn()
    render(<Casco onNovo={onNovo} />)
    await userEvent.click(screen.getByRole('button', { name: 'Novo prazo' }))
    expect(onNovo).toHaveBeenCalledOnce()
  })
})

describe('FolhaApp', () => {
  it('só monta o conteúdo quando "Mais" abre, e fecha ao navegar', async () => {
    render(<Casco />)
    expect(screen.queryByRole('link', { name: 'Histórico' })).not.toBeInTheDocument()

    const mais = screen.getByRole('button', { name: 'Mais' })
    await userEvent.click(mais)
    expect(mais).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Escritório Ana')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Histórico' }))
    expect(screen.queryByRole('link', { name: 'Histórico' })).not.toBeInTheDocument()
    expect(mais).toHaveAttribute('aria-expanded', 'false')
  })
})
