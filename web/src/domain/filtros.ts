import type { DataISO } from './dias'
import { classificarUrgencia, emAberto, precisaConferir, type StatusPrazo } from './urgencia'

export interface PrazoFiltravel {
  status: StatusPrazo
  vencimento: DataISO | null
  origem_prazo?: string | null
  processo?: string | null
  tribunal?: string | null
  orgao?: string | null
  tipo?: string | null
  classe?: string | null
  partes?: string | null
  teor?: string | null
  observacoes?: string | null
  responsavel_id?: string | null
}

export type FiltroStatus = 'abertos' | 'todos' | StatusPrazo

export type FiltroRapido = 'vencido' | 'hoje' | 'semana' | 'conferir' | 'abertos' | null

/** Responsável: `TODOS_RESPONSAVEIS` ou o id de um membro ("Meus prazos" = o próprio id). */
export const TODOS_RESPONSAVEIS = 'todos'

export interface FiltrosPrazos {
  busca?: string
  status?: FiltroStatus
  rapido?: FiltroRapido
  responsavel?: string
  hoje: DataISO
}

export function filtrarPorResponsavel<T extends PrazoFiltravel>(prazos: readonly T[], responsavel?: string): T[] {
  if (!responsavel || responsavel === TODOS_RESPONSAVEIS) return [...prazos]
  return prazos.filter((prazo) => prazo.responsavel_id === responsavel)
}

const CAMPOS_BUSCA = [
  'processo',
  'tribunal',
  'orgao',
  'tipo',
  'classe',
  'partes',
  'teor',
  'observacoes',
] as const

export function filtrarPrazos<T extends PrazoFiltravel>(prazos: readonly T[], filtros: FiltrosPrazos): T[] {
  let selecionados: readonly T[] = filtrarPorResponsavel(prazos, filtros.responsavel)
  if (filtros.status === 'abertos') {
    selecionados = selecionados.filter(emAberto)
  } else if (filtros.status && filtros.status !== 'todos') {
    const esperado = filtros.status
    selecionados = selecionados.filter((prazo) => prazo.status === esperado)
  }
  if (filtros.rapido) {
    const busca = filtros.rapido
    selecionados = selecionados.filter((prazo) => {
      if (busca === 'abertos') return emAberto(prazo)
      const urgencia = classificarUrgencia(prazo, filtros.hoje)
      if (busca === 'vencido') return urgencia === 'vencido'
      if (busca === 'hoje') return urgencia === 'hoje'
      if (busca === 'semana') return ['hoje', 'urgente', 'proximo'].includes(urgencia)
      if (busca === 'conferir') return precisaConferir(prazo)
      return true
    })
  }
  const busca = (filtros.busca ?? '').trim().toLowerCase()
  if (busca) {
    selecionados = selecionados.filter((prazo) =>
      CAMPOS_BUSCA.map((campo) => prazo[campo]).join(' ').toLowerCase().includes(busca),
    )
  }
  return [...selecionados]
}
