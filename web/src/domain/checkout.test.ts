import { describe, expect, it } from 'vitest'
import {
  ehPlano,
  lerReferenciaCheckout,
  planoMenor,
  podeContratar,
  referenciaCheckout,
  resultadoDoRetorno,
  valorDoPlano,
} from './checkout'

const ORG = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

describe('checkout', () => {
  it('cobra o preço de lançamento de cada plano', () => {
    expect(valorDoPlano('solo')).toBe(79.9)
    expect(valorDoPlano('escritorio')).toBe(397.9)
    expect(valorDoPlano('corporativo')).toBe(849.9)
  })

  it('só o Administrador contrata', () => {
    expect(podeContratar('administrador')).toBe(true)
    expect(podeContratar('advogado')).toBe(false)
    expect(podeContratar('assistente')).toBe(false)
    expect(podeContratar('leitura')).toBe(false)
  })

  it('reconhece plano menor, que pausa o excedente', () => {
    expect(planoMenor('escritorio', 'solo')).toBe(true)
    expect(planoMenor('solo', 'escritorio')).toBe(false)
    expect(planoMenor('corporativo', 'corporativo')).toBe(false)
  })

  it('grava e lê a referência da organização', () => {
    expect(lerReferenciaCheckout(referenciaCheckout(ORG, 'solo'))).toEqual({
      organizacaoId: ORG,
      plano: 'solo',
    })
    expect(lerReferenciaCheckout('nao-e-uuid:solo')).toBeNull()
    expect(lerReferenciaCheckout(`${ORG}:anual`)).toBeNull()
    expect(ehPlano('solo')).toBe(true)
    expect(ehPlano('anual')).toBe(false)
  })

  it('só aceita os três retornos do Asaas', () => {
    expect(resultadoDoRetorno('pago')).toBe('pago')
    expect(resultadoDoRetorno('cancelado')).toBe('cancelado')
    expect(resultadoDoRetorno('expirado')).toBe('expirado')
    expect(resultadoDoRetorno('confirmado')).toBeNull()
    expect(resultadoDoRetorno(null)).toBeNull()
  })
})
