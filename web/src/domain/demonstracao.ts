import { diaDaSemana, formatarData } from './datas'
import { calcularVencimento, ehDiaUtil, nomeFeriadoNacional, type DataISO } from './dias'

/** Exemplo fixo da landing page: outubro de 2026 tem o feriado de 12/10 no meio da contagem. */
export const EXEMPLO_PUBLICACAO: DataISO = '2026-10-01'
export const PRAZOS_DE_EXEMPLO = [5, 10, 15] as const

export type Marca =
  | { tipo: 'publicacao' }
  | { tipo: 'util'; numero: number; vencimento: boolean }
  | { tipo: 'pulado'; motivo: string }
  | { tipo: 'livre' }

export interface Contagem {
  publicacao: DataISO
  inicio: DataISO
  vencimento: DataISO
  /** Da publicação ao vencimento, na ordem em que a contagem anda pela agenda. */
  passos: readonly { data: DataISO; marca: Marca }[]
}

function diaSeguinte(iso: DataISO): DataISO {
  const data = new Date(`${iso}T00:00:00Z`)
  data.setUTCDate(data.getUTCDate() + 1)
  return data.toISOString().slice(0, 10)
}

function motivoDoPulo(iso: DataISO): string {
  const feriado = nomeFeriadoNacional(iso)
  if (feriado) return feriado
  return diaDaSemana(iso) === 0 ? 'Domingo' : 'Sábado'
}

/** Contagem com as mesmas regras do robô (feriados nacionais e recesso; ADR-0002). */
export function contarPrazo(publicacao: DataISO, dias: number): Contagem {
  const vencimento = calcularVencimento(diaSeguinte(publicacao), dias)
  const passos: { data: DataISO; marca: Marca }[] = [{ data: publicacao, marca: { tipo: 'publicacao' } }]
  let numero = 0
  let inicio: DataISO | null = null
  for (let data = diaSeguinte(publicacao); data <= vencimento; data = diaSeguinte(data)) {
    if (!ehDiaUtil(data)) {
      passos.push({ data, marca: { tipo: 'pulado', motivo: motivoDoPulo(data) } })
      continue
    }
    numero++
    inicio ??= data
    passos.push({ data, marca: { tipo: 'util', numero, vencimento: data === vencimento } })
  }
  return { publicacao, inicio: inicio ?? vencimento, vencimento, passos }
}

/** Marca de cada dia na agenda depois de `andados` passos da contagem. */
export function marcaDoDia(contagem: Contagem, data: DataISO, andados: number): Marca {
  const indice = contagem.passos.findIndex((p) => p.data === data)
  if (indice < 0 || indice >= andados) return { tipo: 'livre' }
  return contagem.passos[indice].marca
}

const DIAS_DA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function curta(iso: DataISO): string {
  return `${formatarData(iso).slice(0, 5)} (${DIAS_DA_SEMANA[diaDaSemana(iso)]})`
}

/** A contagem narrada em uma frase, para quem não enxerga a grade. */
export function narrarContagem(contagem: Contagem, dias: number): string {
  const pulados = contagem.passos.filter((p) => p.marca.tipo === 'pulado')
  const feriados = pulados.filter((p) => nomeFeriadoNacional(p.data))
  const fimDeSemana = pulados.length - feriados.length
  const naoContam = [
    fimDeSemana > 0 ? `${fimDeSemana} dias de fim de semana` : null,
    ...feriados.map((f) => `o feriado de ${formatarData(f.data).slice(0, 5)}`),
  ].filter(Boolean)
  return (
    `Publicação em ${curta(contagem.publicacao)}. Início em ${curta(contagem.inicio)}. ` +
    `${dias} dias úteis${naoContam.length ? `, sem contar ${naoContam.join(' e ')}` : ''}. ` +
    `Vencimento em ${curta(contagem.vencimento)}.`
  )
}
