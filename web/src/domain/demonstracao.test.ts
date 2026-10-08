import { describe, expect, it } from 'vitest'
import { contarPrazo, EXEMPLO_PUBLICACAO, marcaDoDia, narrarContagem } from './demonstracao'
import { calcularVencimento } from './dias'

describe('contarPrazo', () => {
  it.each([
    [5, '2026-10-08'],
    [10, '2026-10-16'],
    [15, '2026-10-23'],
  ])('prazo de %i dias úteis publicado em 01/10/2026 vence em %s', (dias, vencimento) => {
    expect(contarPrazo(EXEMPLO_PUBLICACAO, dias).vencimento).toBe(vencimento)
  })

  it('usa o mesmo cálculo do robô', () => {
    const contagem = contarPrazo(EXEMPLO_PUBLICACAO, 15)
    expect(contagem.vencimento).toBe(calcularVencimento(contagem.inicio, 15))
  })

  it('começa no primeiro dia útil depois da publicação', () => {
    expect(contarPrazo(EXEMPLO_PUBLICACAO, 5).inicio).toBe('2026-10-02')
    expect(contarPrazo('2026-10-02', 5).inicio).toBe('2026-10-05')
  })

  it('numera só os dias úteis e explica cada dia pulado', () => {
    const { passos } = contarPrazo(EXEMPLO_PUBLICACAO, 10)
    expect(passos[0]).toEqual({ data: '2026-10-01', marca: { tipo: 'publicacao' } })
    expect(passos.find((p) => p.data === '2026-10-03')?.marca).toEqual({ tipo: 'pulado', motivo: 'Sábado' })
    expect(passos.find((p) => p.data === '2026-10-04')?.marca).toEqual({ tipo: 'pulado', motivo: 'Domingo' })
    expect(passos.find((p) => p.data === '2026-10-12')?.marca).toEqual({
      tipo: 'pulado',
      motivo: 'Nossa Senhora Aparecida',
    })
    const uteis = passos.filter((p) => p.marca.tipo === 'util')
    expect(uteis).toHaveLength(10)
    expect(uteis.at(-1)).toEqual({ data: '2026-10-16', marca: { tipo: 'util', numero: 10, vencimento: true } })
  })
})

describe('marcaDoDia', () => {
  const contagem = contarPrazo(EXEMPLO_PUBLICACAO, 5)

  it('revela as marcas conforme a contagem anda', () => {
    expect(marcaDoDia(contagem, '2026-10-02', 1)).toEqual({ tipo: 'livre' })
    expect(marcaDoDia(contagem, '2026-10-02', 2)).toEqual({ tipo: 'util', numero: 1, vencimento: false })
  })

  it('dias fora da contagem ficam livres', () => {
    expect(marcaDoDia(contagem, '2026-10-30', 99)).toEqual({ tipo: 'livre' })
  })
})

describe('narrarContagem', () => {
  it('descreve início, dias que não contam e vencimento', () => {
    expect(narrarContagem(contarPrazo(EXEMPLO_PUBLICACAO, 15), 15)).toBe(
      'Publicação em 01/10 (qui). Início em 02/10 (sex). 15 dias úteis, sem contar 6 dias de fim de semana e o feriado de 12/10. Vencimento em 23/10 (sex).',
    )
  })

  it('omite o feriado quando a contagem não passa por ele', () => {
    expect(narrarContagem(contarPrazo(EXEMPLO_PUBLICACAO, 5), 5)).toBe(
      'Publicação em 01/10 (qui). Início em 02/10 (sex). 5 dias úteis, sem contar 2 dias de fim de semana. Vencimento em 08/10 (qui).',
    )
  })
})
