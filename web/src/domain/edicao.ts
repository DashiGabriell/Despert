import { ehDataISO } from './datas'
import { calcularVencimento, type DataISO, type OpcoesDias } from './dias'
import type { StatusPrazo } from './urgencia'

export const ORIGEM_MANUAL = 'Cadastro manual'
export const ORIGEM_AJUSTADA = 'Ajustado manualmente'
export const ORIGEM_CONFERIDA = 'Conferido pelo advogado'

/** Vencimento pela regra de dias úteis (ADR-0002), ou `null` se faltar início ou dias. */
export function recalcularVencimento(
  inicio: string | null | undefined,
  dias: number | null | undefined,
  opcoes: OpcoesDias,
): DataISO | null {
  if (!ehDataISO(inicio) || !dias || !Number.isInteger(dias) || dias < 1) return null
  return calcularVencimento(inicio, dias, opcoes)
}

export interface PrazoEditavel {
  status: StatusPrazo
  vencimento: string | null
  prazo_dias: number | null
  inicio_prazo: string | null
  observacoes: string | null
  cumprido_em: string | null
  origem_prazo: string | null
}

export interface EdicaoPrazo {
  status: StatusPrazo
  vencimento: string
  prazo_dias: number | null
  inicio_prazo: string
  observacoes: string
}

export type AtualizacaoPrazo = PrazoEditavel

/**
 * Traduz o formulário de edição na gravação, mantendo o prazo coerente:
 * mexer na contagem tira o prazo de "para conferir", marca a origem como ajustada
 * e cumprido_em acompanha o status.
 */
export function montarAtualizacao(
  original: PrazoEditavel,
  edicao: EdicaoPrazo,
  agora: string,
): AtualizacaoPrazo {
  const vencimento = edicao.vencimento || null
  const inicio = edicao.inicio_prazo || null
  const mudouContagem =
    vencimento !== original.vencimento ||
    edicao.prazo_dias !== original.prazo_dias ||
    inicio !== original.inicio_prazo

  let status = edicao.status
  if (status === 'conferir' && original.status === 'conferir' && mudouContagem) status = 'pendente'
  const conferiu = original.status === 'conferir' && status === 'pendente'

  let origem = original.origem_prazo
  if (mudouContagem) origem = ORIGEM_AJUSTADA
  else if (conferiu) origem = ORIGEM_CONFERIDA

  let cumpridoEm: string | null = null
  if (status === 'cumprido') {
    cumpridoEm = original.status === 'cumprido' && original.cumprido_em ? original.cumprido_em : agora
  }

  return {
    status,
    vencimento,
    prazo_dias: edicao.prazo_dias,
    inicio_prazo: inicio,
    observacoes: edicao.observacoes.trim() || null,
    cumprido_em: cumpridoEm,
    origem_prazo: origem,
  }
}
