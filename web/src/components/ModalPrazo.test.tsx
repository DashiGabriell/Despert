import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { pode } from '../domain/permissoes'
import type { MembroDaEquipe, PapelMembro } from '../lib/database.types'
import { fabricarPrazo } from '../test/fabricas'
import ModalPrazo, { type PermissoesPrazo } from './ModalPrazo'

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

describe('ModalPrazo por papel', () => {
  const EQUIPE: MembroDaEquipe[] = [
    { user_id: 'advogada-1', email: 'ana@exemplo.com', papel: 'administrador', criado_em: '' },
    { user_id: 'bruno-1', email: 'bruno@exemplo.com', papel: 'advogado', criado_em: '' },
  ]
  const permissoesDe = (papel: PapelMembro): PermissoesPrazo => ({
    editar: pode(papel, 'editar_prazo'),
    cumprir: pode(papel, 'cumprir_prazo'),
    excluir: pode(papel, 'excluir_prazo'),
    trocarResponsavel: pode(papel, 'trocar_responsavel'),
  })
  const botao = (nome: string) => screen.queryByRole('button', { name: nome }) !== null

  it.each([
    ['administrador', { salvar: true, cumprir: true, excluir: true }],
    ['advogado', { salvar: true, cumprir: true, excluir: true }],
    ['assistente', { salvar: true, cumprir: true, excluir: false }],
    ['leitura', { salvar: false, cumprir: false, excluir: false }],
  ] as const)('%s vê só as ações permitidas', (papel, esperado) => {
    abrir(fabricarPrazo(), { permissoes: permissoesDe(papel), membros: EQUIPE, eu: 'advogada-1' })
    expect(botao('Salvar')).toBe(esperado.salvar)
    expect(botao('Marcar cumprido')).toBe(esperado.cumprir)
    expect(botao('Excluir')).toBe(esperado.excluir)
    expect(screen.getByLabelText('Responsável')).toHaveProperty('disabled', papel === 'leitura')
    expect(screen.getByLabelText('Prazo (dias úteis)')).toHaveProperty('disabled', papel === 'leitura')
  })

  it('Leitura só pode fechar o detalhe', async () => {
    const { onFechar } = abrir(fabricarPrazo(), { permissoes: permissoesDe('leitura'), membros: EQUIPE })
    const rodape = screen.getAllByRole('button', { name: 'Fechar' }).at(-1)!
    expect(rodape).toHaveTextContent('Fechar')
    await userEvent.click(rodape)
    expect(onFechar).toHaveBeenCalled()
  })

  it('troca o responsável e grava junto com o prazo', async () => {
    const { onSalvar } = abrir(fabricarPrazo(), { membros: EQUIPE, eu: 'advogada-1' })
    const campo = screen.getByLabelText('Responsável')
    expect(campo).toHaveDisplayValue('ana (você)')
    await userEvent.selectOptions(campo, 'bruno-1')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ responsavel_id: 'bruno-1' }))
  })

  it('sem trocar o responsável não o envia', async () => {
    const onSalvar = vi.fn().mockResolvedValue(undefined)
    abrir(fabricarPrazo(), { membros: EQUIPE, eu: 'advogada-1', onSalvar })
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(onSalvar.mock.calls[0][0]).not.toHaveProperty('responsavel_id')
  })

  it('mostra quem mais a publicação intimou', () => {
    abrir(fabricarPrazo({ tambem_intimados: ['bruno-1', 'saiu-1'] }), { membros: EQUIPE, eu: 'advogada-1' })
    expect(screen.getByText(/^Também intimados:/)).toHaveTextContent('Também intimados: bruno, ex-membro da equipe')
  })

  it('no Solo não mostra o responsável', () => {
    abrir()
    expect(screen.queryByLabelText('Responsável')).not.toBeInTheDocument()
  })
})
