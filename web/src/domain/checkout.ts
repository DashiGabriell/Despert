import type { PapelMembro, Plano } from '../lib/database.types'
import { PLANOS } from './planos'
import { PRECO_MENSAL } from './precos'

export type ResultadoRetorno = 'pago' | 'cancelado' | 'expirado'

const RESULTADOS: readonly ResultadoRetorno[] = ['pago', 'cancelado', 'expirado']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function ehPlano(valor: string): valor is Plano {
  return (PLANOS as readonly string[]).includes(valor)
}

/** Valor cobrado no Asaas. O navegador não escolhe o preço. */
export function valorDoPlano(plano: Plano): number {
  return PRECO_MENSAL[plano]
}

export function podeContratar(papel: PapelMembro): boolean {
  return papel === 'administrador'
}

/** Plano de índice menor que o atual: a troca pausa o que passar do novo limite. */
export function planoMenor(atual: Plano, escolhido: Plano): boolean {
  return PLANOS.indexOf(escolhido) < PLANOS.indexOf(atual)
}

/** Liga o checkout à organização. O webhook não confia no corpo além do id gravado. */
export function referenciaCheckout(organizacaoId: string, plano: Plano): string {
  return `${organizacaoId}:${plano}`
}

export function lerReferenciaCheckout(referencia: string): { organizacaoId: string; plano: Plano } | null {
  const separador = referencia.lastIndexOf(':')
  if (separador <= 0) return null
  const organizacaoId = referencia.slice(0, separador)
  const plano = referencia.slice(separador + 1)
  if (!UUID.test(organizacaoId) || !ehPlano(plano)) return null
  return { organizacaoId, plano }
}

export function resultadoDoRetorno(valor: string | null): ResultadoRetorno | null {
  if (!valor || !(RESULTADOS as readonly string[]).includes(valor)) return null
  return valor as ResultadoRetorno
}
