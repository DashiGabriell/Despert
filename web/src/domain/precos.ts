import type { Plano } from '../lib/database.types'
import { LIMITES_PADRAO, PLANOS, type Limites } from './planos'

/** Preço mensal de lançamento (ADR-0009). O checkout cobra este valor; não há plano anual. */
export const PRECO_MENSAL: Record<Plano, number> = {
  solo: 79.9,
  escritorio: 397.9,
  corporativo: 849.9,
}

export function formatarPreco(valor: number): string {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`
}

/** Faixa de usuários do plano: começa onde o plano anterior termina (ADR-0008). */
export function faixaDeUsuarios(plano: Plano): string {
  const indice = PLANOS.indexOf(plano)
  const maximo = LIMITES_PADRAO[plano].usuarios
  const minimo = indice === 0 ? 1 : LIMITES_PADRAO[PLANOS[indice - 1]].usuarios + 1
  return minimo === maximo ? String(maximo) : `${minimo} a ${maximo}`
}

function buscasAutomaticas(l: Limites): string {
  return l.buscas_automaticas === 1 ? '1, às 07:00' : '2, às 07:00 e às 12:00'
}

function buscaAgora(l: Limites): string {
  if (l.buscas_agora_dia <= 1) return `${l.buscas_agora_dia} por dia`
  return `${l.buscas_agora_dia} por dia, com ${l.intervalo_busca_min} min de intervalo`
}

export interface LinhaDaComparacao {
  rotulo: string
  valores: Record<Plano, string>
}

const LINHAS: readonly [string, (l: Limites, plano: Plano) => string][] = [
  ['Usuários', (_, plano) => faixaDeUsuarios(plano)],
  ['OABs monitoradas', (l) => (l.oabs === 'por_advogado' ? '1 por advogado' : String(l.oabs))],
  ['Processos avulsos', (l) => String(l.processos)],
  ['Buscas automáticas por dia útil', buscasAutomaticas],
  ['Busca agora', buscaAgora],
  ['Papéis da equipe', (l) => (l.papeis ? 'Administrador, Advogado, Assistente e Leitura' : 'Só o Administrador')],
  ['Auditoria e exportação em CSV', (l) => (l.auditoria ? 'Sim' : 'Não')],
]

/** Tabela de planos da landing page, derivada dos limites padrão para não divergir do app. */
export function comparacaoDosPlanos(): LinhaDaComparacao[] {
  return LINHAS.map(([rotulo, descrever]) => ({
    rotulo,
    valores: Object.fromEntries(PLANOS.map((p) => [p, descrever(LIMITES_PADRAO[p], p)])) as Record<Plano, string>,
  }))
}
