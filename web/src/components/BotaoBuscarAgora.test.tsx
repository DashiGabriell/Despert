import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import BotaoBuscarAgora from './BotaoBuscarAgora'

describe('BotaoBuscarAgora', () => {
  it('ocioso: habilitado e dispara a busca', async () => {
    const onBuscar = vi.fn()
    render(<BotaoBuscarAgora estado="ocioso" restanteMs={0} onBuscar={onBuscar} />)
    const botao = screen.getByRole('button', { name: /Buscar agora/ })
    expect(botao).toBeEnabled()
    await userEvent.click(botao)
    expect(onBuscar).toHaveBeenCalledOnce()
  })

  it('buscando: mostra progresso e fica desabilitado', () => {
    render(<BotaoBuscarAgora estado="buscando" restanteMs={600_000} onBuscar={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Buscando…/ })).toBeDisabled()
  })

  it('bloqueado: mostra a contagem regressiva do cooldown', () => {
    render(<BotaoBuscarAgora estado="bloqueado" restanteMs={125_000} onBuscar={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Nova busca em 2:05' })).toBeDisabled()
  })
})
