import type { DataISO } from './dias'

/** Fuso do expediente forense usado para decidir o que é "hoje". */
export const FUSO = 'America/Sao_Paulo'

/** Mês no formato `YYYY-MM`. */
export type MesISO = string

const NOMES_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function paraData(iso: DataISO): Date {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia))
}

function paraISO(data: Date): DataISO {
  return data.toISOString().slice(0, 10)
}

export function ehDataISO(valor: string | null | undefined): valor is DataISO {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  return paraISO(paraData(valor)) === valor
}

/** A data de hoje no fuso de Brasília. */
export function hojeISO(agora: Date): DataISO {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora)
}

export function somarDias(iso: DataISO, quantidade: number): DataISO {
  const data = paraData(iso)
  data.setUTCDate(data.getUTCDate() + quantidade)
  return paraISO(data)
}

/** `dd/mm/aaaa`, ou travessão quando não há data. */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

export function formatarDataHora(instante: string | null | undefined): string {
  if (!instante) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(instante))
}

export function mesDe(iso: DataISO): MesISO {
  return iso.slice(0, 7)
}

export function somarMeses(mes: MesISO, quantidade: number): MesISO {
  const [ano, numero] = mes.split('-').map(Number)
  const indice = ano * 12 + (numero - 1) + quantidade
  return `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, '0')}`
}

export function nomeDoMes(mes: MesISO): string {
  const [ano, numero] = mes.split('-').map(Number)
  return `${NOMES_MESES[numero - 1]} de ${ano}`
}

/** As 42 datas (6 semanas, domingo a sábado) que cobrem o mês na grade da agenda. */
export function gradeDoMes(mes: MesISO): DataISO[] {
  const primeiro = paraData(`${mes}-01`)
  const inicio = somarDias(`${mes}-01`, -primeiro.getUTCDay())
  return Array.from({ length: 42 }, (_, i) => somarDias(inicio, i))
}

export function diaDaSemana(iso: DataISO): number {
  return paraData(iso).getUTCDay()
}
