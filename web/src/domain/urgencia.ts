import type { DataISO } from './dias'

export type Urgencia =
  | 'fechado'
  | 'semdata'
  | 'vencido'
  | 'hoje'
  | 'urgente'
  | 'proximo'
  | 'futuro'

export type StatusPrazo = 'pendente' | 'conferir' | 'cumprido' | 'arquivado'

export interface PrazoUrgencia {
  status: StatusPrazo
  vencimento: DataISO | null
  origem_prazo?: string | null
}

export function diasAte(vencimento: DataISO | null, hoje: DataISO): number | null {
  if (!vencimento) return null
  return Math.round((Date.parse(vencimento) - Date.parse(hoje)) / 86_400_000)
}

/** Prazo ainda em aberto: pendente ou aguardando conferência do advogado. */
export function emAberto(prazo: Pick<PrazoUrgencia, 'status'>): boolean {
  return prazo.status === 'pendente' || prazo.status === 'conferir'
}

/** O robô não soube extrair o prazo com segurança; o advogado precisa confirmar. */
export function precisaConferir(prazo: PrazoUrgencia): boolean {
  if (!emAberto(prazo)) return false
  if (prazo.status === 'conferir') return true
  return /Padrão|CONFERIR/.test(prazo.origem_prazo ?? '')
}

export function classificarUrgencia(prazo: PrazoUrgencia, hoje: DataISO): Urgencia {
  if (!emAberto(prazo)) return 'fechado'
  const dias = diasAte(prazo.vencimento, hoje)
  if (dias === null) return 'semdata'
  if (dias < 0) return 'vencido'
  if (dias === 0) return 'hoje'
  if (dias !== null && dias <= 3) return 'urgente'
  if (dias !== null && dias <= 7) return 'proximo'
  return 'futuro'
}
