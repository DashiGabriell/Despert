import { describe, expect, it } from 'vitest'
import { calcularVencimento } from './dias'

describe('calcularVencimento', () => {
  it('conta o dia de início como dia 1 e segue em dias úteis', () => {
    // segunda 05/10/2026, 3 dias úteis → quarta 07/10/2026
    expect(calcularVencimento('2026-10-05', 3)).toBe('2026-10-07')
  })

  it('pula feriado nacional', () => {
    // 21/04/2026 (Tiradentes) é terça-feira feriada
    expect(calcularVencimento('2026-04-20', 2)).toBe('2026-04-22')
  })

  it('pula a Sexta-feira Santa, obtida da Páscoa do ano', () => {
    // Páscoa 2026 = 05/04 (domingo) → sexta-feira santa = 03/04/2026
    expect(calcularVencimento('2026-04-02', 3)).toBe('2026-04-07')
  })

  it('pula feriado local cadastrado pelo advogado', () => {
    // 06/10/2026 (terça) cadastrado como feriado local
    expect(calcularVencimento('2026-10-05', 2, { feriadosLocais: ['2026-10-06'] })).toBe(
      '2026-10-07',
    )
  })

  it('suspende a contagem durante o recesso forense (20/12 a 20/01)', () => {
    // início sexta 18/12/2026, 5 dias úteis → recesso empurra para 26/01/2027
    expect(calcularVencimento('2026-12-18', 5, { considerarRecesso: true })).toBe('2027-01-26')
  })

  it('conta normalmente quando o recesso está desativado', () => {
    expect(calcularVencimento('2026-12-18', 5, { considerarRecesso: false })).toBe('2026-12-24')
  })

  it('quando o início não é dia útil, começa no próximo dia útil', () => {
    // sábado 03/10/2026 → segunda 05/10 vale como dia 1, terça 06/10 é o vencimento
    expect(calcularVencimento('2026-10-03', 2)).toBe('2026-10-06')
  })

  it('atravessa a virada do ano pulando o feriado de 01/01', () => {
    // quarta 30/12/2026, recesso desativado → sexta 01/01 é feriada, segunda 04/01 é dia 3
    expect(calcularVencimento('2026-12-30', 5, { considerarRecesso: false })).toBe('2027-01-06')
  })

  it('com o recesso ativo, prazo iniciado em dezembro só vence em janeiro', () => {
    // 30/12/2026 está no recesso → dia 1 vira 21/01/2027 e o vencimento cai em 27/01/2027
    expect(calcularVencimento('2026-12-30', 5)).toBe('2027-01-27')
  })
})
