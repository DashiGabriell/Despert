import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fabricarPrazo } from '../test/fabricas'
import ModalPrazo from './ModalPrazo'

const HOJE = '2026-10-06'

function abrir(prazo = fabricarPrazo(), extras: Partial<Parameters<typeof ModalPrazo>[0]> = {}) {
  const props = {
    prazo,
    hoje: HOJE,
    opcoesDias: {},
    onSalvar: vi.fn().mockResolvedValue(undefined),
    onExcluir: vi.fn().mockResolvedValue(undefined),
    onFechar: vi.fn(),
    ...extras,
  }
  render(<ModalPrazo {...props} />)
  return props
}

describe('ModalPrazo', () => {
  it('exibe datas, origem, partes, teor e o link para o documento', () => {
    abrir()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('01/10/2026')).toBeInTheDocument() // disponibilização
    expect(screen.getByText('02/10/2026')).toBeInTheDocument() // publicação
    expect(screen.getByText('05/10/2026')).toBeInTheDocument() // início
    expect(screen.getByText('Identificado no texto')).toBeInTheDocument()
    expect(screen.getByText('ACME LTDA (Polo ativo)')).toBeInTheDocument()
    expect(screen.getByText(/apresentar contestação/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Abrir documento no tribunal/ })).toHaveAttribute(
      'href',
      'https://comunica.pje.jus.br/',
    )
  })

  it('recalcula o vencimento em dias úteis ao mudar os dias e grava como ajustado', async () => {
    const { onSalvar } = abrir()
    const dias = screen.getByLabelText('Prazo (dias úteis)')
    await userEvent.clear(dias)
    await userEvent.type(dias, '5')

    // início 05/10/2026 (segunda) vale como dia 1 → 5º dia útil é 09/10 (sexta)
    expect(screen.getByLabelText('Vencimento')).toHaveValue('2026-10-09')
    expect(screen.getByText(/Vencimento recalculado em dias úteis: 09\/10\/2026/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(onSalvar).toHaveBeenCalledWith(
      expect.objectContaining({
        prazo_dias: 5,
        vencimento: '2026-10-09',
        origem_prazo: 'Ajustado manualmente',
        status: 'pendente',
      }),
    )
  })

  it('considera feriados locais no recálculo', async () => {
    abrir(fabricarPrazo(), { opcoesDias: { feriadosLocais: ['2026-10-06'] } })
    const dias = screen.getByLabelText('Prazo (dias úteis)')
    await userEvent.clear(dias)
    await userEvent.type(dias, '2')
    expect(screen.getByLabelText('Vencimento')).toHaveValue('2026-10-07')
  })

  it('destaca prazo para conferir e marca como cumprido pelo detalhe', async () => {
    const { onSalvar } = abrir(fabricarPrazo({ status: 'conferir', origem_prazo: 'Padrão (15 dias)' }))
    expect(screen.getByText(/o robô não identificou o prazo com segurança/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Marcar cumprido' }))
    expect(onSalvar).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cumprido', cumprido_em: expect.any(String) }),
    )
  })

  it('não oferece "Marcar cumprido" para prazo já fechado', () => {
    abrir(fabricarPrazo({ status: 'cumprido', cumprido_em: '2026-10-05T12:00:00Z' }))
    expect(screen.queryByRole('button', { name: 'Marcar cumprido' })).not.toBeInTheDocument()
    expect(screen.getByText('Cumprido em')).toBeInTheDocument()
  })

  it('pede confirmação antes de excluir, avisando da recaptura', async () => {
    const { onExcluir } = abrir()
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(screen.getByText(/o robô vai capturá-la de novo/)).toBeInTheDocument()
    expect(onExcluir).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))
    expect(onExcluir).toHaveBeenCalled()
  })

  it('mostra o erro de gravação sem fechar', async () => {
    const onSalvar = vi.fn().mockRejectedValue(new Error('sem conexão'))
    const { onFechar } = abrir(fabricarPrazo(), { onSalvar })
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('sem conexão')).toBeInTheDocument()
    expect(onFechar).not.toHaveBeenCalled()
  })
})
