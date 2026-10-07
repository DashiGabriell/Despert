import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fabricarPrazo } from '../test/fabricas'
import TabelaPrazos from './TabelaPrazos'

const HOJE = '2026-10-06'

describe('TabelaPrazos', () => {
  it('mostra o selo certo para cada estado de urgência', () => {
    const prazos = [
      fabricarPrazo({ vencimento: '2026-10-01' }),
      fabricarPrazo({ vencimento: HOJE }),
      fabricarPrazo({ vencimento: '2026-10-07' }),
      fabricarPrazo({ vencimento: '2026-10-12' }),
      fabricarPrazo({ vencimento: '2026-10-30' }),
      fabricarPrazo({ vencimento: null }),
      fabricarPrazo({ status: 'cumprido' }),
    ]
    render(<TabelaPrazos prazos={prazos} hoje={HOJE} vazio="nada" onAbrir={vi.fn()} onCumprir={vi.fn()} />)

    const selos = screen.getAllByText(/./, { selector: '[data-urgencia]' })
    expect(selos.map((s) => [s.dataset.urgencia, s.textContent])).toEqual([
      ['vencido', 'Vencido há 5 dias'],
      ['hoje', 'Vence hoje'],
      ['urgente', 'Amanhã'],
      ['proximo', 'Em 6 dias'],
      ['futuro', 'Em 24 dias'],
      ['semdata', 'Sem data'],
      ['fechado', 'Cumprido'],
    ])
  })

  it('marca como cumprido sem abrir o detalhe, e só para prazos em aberto', async () => {
    const aberto = fabricarPrazo()
    const cumprido = fabricarPrazo({ status: 'cumprido', processo: '9999999-99.2026.8.26.0001' })
    const onAbrir = vi.fn()
    const onCumprir = vi.fn()
    render(
      <TabelaPrazos prazos={[aberto, cumprido]} hoje={HOJE} vazio="nada" onAbrir={onAbrir} onCumprir={onCumprir} />,
    )

    const botoes = screen.getAllByRole('button', { name: 'Cumprido' })
    expect(botoes).toHaveLength(1)
    await userEvent.click(botoes[0])
    expect(onCumprir).toHaveBeenCalledWith(aberto)
    expect(onAbrir).not.toHaveBeenCalled()

    await userEvent.click(screen.getByText('9999999-99.2026.8.26.0001'))
    expect(onAbrir).toHaveBeenCalledWith(cumprido)
  })

  it('sinaliza os prazos para conferir e mostra o estado vazio', () => {
    const { rerender } = render(
      <TabelaPrazos
        prazos={[fabricarPrazo({ status: 'conferir', origem_prazo: 'Padrão (15 dias)' })]}
        hoje={HOJE}
        vazio="nada"
        onAbrir={vi.fn()}
        onCumprir={vi.fn()}
      />,
    )
    expect(screen.getByText('conferir')).toBeInTheDocument()

    rerender(
      <TabelaPrazos prazos={[]} hoje={HOJE} vazio="Cadastre uma OAB" onAbrir={vi.fn()} onCumprir={vi.fn()} />,
    )
    const linha = screen.getByText('Cadastre uma OAB').closest('tr')!
    expect(within(linha).getByText('Cadastre uma OAB')).toBeInTheDocument()
  })
})
