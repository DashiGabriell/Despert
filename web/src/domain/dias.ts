import { domingoDePascoa } from './pascoa'

/** Data no formato ISO `YYYY-MM-DD`, sem fuso — o prazo é calendário, não instante. */
export type DataISO = string

export interface OpcoesDias {
  /** Feriados estaduais/municipais e suspensões de expediente cadastrados pelo advogado. */
  feriadosLocais?: readonly DataISO[]
  /** Considera o recesso forense de 20/12 a 20/01 (CPC art. 220). */
  considerarRecesso?: boolean
}

function paraData(iso: DataISO): Date {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia))
}

function paraISO(data: Date): DataISO {
  return data.toISOString().slice(0, 10)
}

function somaDias(data: Date, quantidade: number): Date {
  const copia = new Date(data)
  copia.setUTCDate(copia.getUTCDate() + quantidade)
  return copia
}

const FERIADOS_NACIONAIS_FIXOS = [
  '01-01', // Confraternização Universal
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência
  '10-12', // Nossa Senhora Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '11-20', // Consciência Negra
  '12-25', // Natal
]

const sextaFeiraSanta = new Map<number, DataISO>()

function ehSextaFeiraSanta(iso: DataISO): boolean {
  const ano = Number(iso.slice(0, 4))
  let santa = sextaFeiraSanta.get(ano)
  if (!santa) {
    santa = paraISO(somaDias(paraData(domingoDePascoa(ano)), -2))
    sextaFeiraSanta.set(ano, santa)
  }
  return iso === santa
}

/** Recesso forense de 20/12 a 20/01 (CPC art. 220), ativo por padrão. */
function emRecesso(iso: DataISO): boolean {
  const mesDia = iso.slice(5)
  return mesDia >= '12-20' || mesDia <= '01-20'
}

export function ehDiaUtil(iso: DataISO, opcoes: OpcoesDias = {}): boolean {
  const data = paraData(iso)
  const diaSemana = data.getUTCDay()
  if (diaSemana === 0 || diaSemana === 6) return false
  if (ehSextaFeiraSanta(iso)) return false
  if (opcoes.feriadosLocais?.includes(iso)) return false
  if (opcoes.considerarRecesso !== false && emRecesso(iso)) return false
  return !FERIADOS_NACIONAIS_FIXOS.includes(iso.slice(5))
}

export function proximoDiaUtil(iso: DataISO, opcoes: OpcoesDias = {}): DataISO {
  let atual = somaDias(paraData(iso), 1)
  while (!ehDiaUtil(paraISO(atual), opcoes)) atual = somaDias(atual, 1)
  return paraISO(atual)
}

/**
 * Calcula o vencimento somando dias úteis a partir do início.
 * O dia de início vale como dia 1 (mesma regra do robô — ver ADR-0002).
 */
export function calcularVencimento(
  inicio: DataISO,
  dias: number,
  opcoes: OpcoesDias = {},
): DataISO {
  let atual = ehDiaUtil(inicio, opcoes) ? inicio : proximoDiaUtil(inicio, opcoes)
  for (let decorridos = 1; decorridos < dias; decorridos++) {
    atual = proximoDiaUtil(atual, opcoes)
  }
  return atual
}
