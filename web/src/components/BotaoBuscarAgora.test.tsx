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

  it('bloqueado: mostra a contagem regressiva do cooldown com o intervalo do plano', () => {
    render(<BotaoBuscarAgora estado="bloqueado" restanteMs={125_000} intervaloMin={30} onBuscar={vi.fn()} />)
    const botao = screen.getByRole('button', { name: 'Nova busca em 2:05' })
    expect(botao).toBeDisabled()
    expect(botao).toHaveAttribute('title', expect.stringContaining('a cada 30 minutos'))
  })

  it('esgotado: avisa que a cota do dia acabou', () => {
    render(<BotaoBuscarAgora estado="esgotado" restanteMs={0} onBuscar={vi.fn()} />)
    const botao = screen.getByRole('button', { name: 'Buscas de hoje usadas' })
    expect(botao).toBeDisabled()
    expect(botao).toHaveAttribute('title', expect.stringContaining('meia-noite'))
  })

  it('indisponível: desligado em somente leitura', () => {
    render(<BotaoBuscarAgora estado="indisponivel" restanteMs={0} onBuscar={vi.fn()} />)
    const botao = screen.getByRole('button', { name: /Buscar agora/ })
    expect(botao).toBeDisabled()
    expect(botao).toHaveAttribute('title', expect.stringContaining('somente leitura'))
  })

  it('ocioso: mostra quantas buscas manuais restam hoje', () => {
    render(<BotaoBuscarAgora estado="ocioso" restanteMs={0} restantesHoje={3} onBuscar={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Buscar agora/ })).toHaveAttribute(
      'title',
      '3 busca(s) manual(is) disponível(is) hoje.',
    )
  })
})
