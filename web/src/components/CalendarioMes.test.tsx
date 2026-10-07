import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Prazo } from '../lib/database.types'
import { fabricarPrazo } from '../test/fabricas'
import CalendarioMes from './CalendarioMes'

const HOJE = '2026-10-06'

function Agenda({ prazos, onAbrir = vi.fn(), onCriar = vi.fn() }: {
  prazos: Prazo[]
  onAbrir?: (p: Prazo) => void
  onCriar?: (d: string) => void
}) {
  const [mes, setMes] = useState('2026-10')
  return (
    <CalendarioMes
      mes={mes}
      hoje={HOJE}
      prazos={prazos}
      feriados={[{ data: '2026-10-15', descricao: 'Feriado municipal' }]}
      onMudarMes={setMes}
      onAbrirPrazo={onAbrir}
      onCriarNoDia={onCriar}
    />
  )
}

describe('CalendarioMes', () => {
  it('navega entre meses e volta para o mês de hoje', async () => {
    render(<Agenda prazos={[]} />)
    expect(screen.getByRole('heading', { name: 'Outubro de 2026' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Próximo mês' }))
    await userEvent.click(screen.getByRole('button', { name: 'Próximo mês' }))
    await userEvent.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(screen.getByRole('heading', { name: 'Janeiro de 2027' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Hoje' }))
    await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' }))
    expect(screen.getByRole('heading', { name: 'Setembro de 2026' })).toBeInTheDocument()
  })

  it('compõe chips por urgência, risca cumpridos e esconde arquivados', () => {
    render(
      <Agenda
        prazos={[
          fabricarPrazo({ vencimento: '2026-10-08', processo: 'PROC-URGENTE' }),
          fabricarPrazo({ vencimento: '2026-10-08', processo: 'PROC-CUMPRIDO', status: 'cumprido' }),
          fabricarPrazo({ vencimento: '2026-10-20', processo: 'PROC-ARQUIVADO', status: 'arquivado' }),
        ]}
      />,
    )
    const urgente = screen.getByRole('button', { name: 'PROC-URGENTE' })
    expect(urgente.dataset.urgencia).toBe('urgente')
    const cumprido = screen.getByRole('button', { name: 'PROC-CUMPRIDO' })
    expect(cumprido.dataset.urgencia).toBe('fechado')
    expect(cumprido.className).toContain('line-through')
    expect(screen.queryByText('PROC-ARQUIVADO')).not.toBeInTheDocument()
  })

  it('destaca feriados locais e nacionais no dia', () => {
    render(<Agenda prazos={[]} />)
    expect(screen.getByText('Feriado municipal')).toBeInTheDocument()
    expect(screen.getByText('Nossa Senhora Aparecida')).toBeInTheDocument()
  })

  it('chip abre o prazo e dia vazio cria prazo com a data', async () => {
    const prazo = fabricarPrazo({ vencimento: '2026-10-08', processo: 'PROC-1' })
    const onAbrir = vi.fn()
    const onCriar = vi.fn()
    render(<Agenda prazos={[prazo]} onAbrir={onAbrir} onCriar={onCriar} />)

    await userEvent.click(screen.getByRole('button', { name: 'PROC-1' }))
    expect(onAbrir).toHaveBeenCalledWith(prazo)

    await userEvent.click(screen.getByRole('button', { name: 'Criar prazo em 21/10/2026' }))
    expect(onCriar).toHaveBeenCalledWith('2026-10-21')
    expect(screen.queryByRole('button', { name: 'Criar prazo em 08/10/2026' })).not.toBeInTheDocument()
  })
})
