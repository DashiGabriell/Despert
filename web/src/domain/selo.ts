import type { DataISO } from './dias'
import { classificarUrgencia, diasAte, type PrazoUrgencia, type StatusPrazo, type Urgencia } from './urgencia'

export const ROTULO_STATUS: Record<StatusPrazo, string> = {
  pendente: 'Pendente',
  conferir: 'Para conferir',
  cumprido: 'Cumprido',
  arquivado: 'Arquivado',
}

export interface Selo {
  urgencia: Urgencia
  texto: string
}

/** O selo de situação mostrado ao lado do prazo na lista, na agenda e no detalhe. */
export function seloDoPrazo(prazo: PrazoUrgencia, hoje: DataISO): Selo {
  const urgencia = classificarUrgencia(prazo, hoje)
  const dias = diasAte(prazo.vencimento, hoje) ?? 0
  switch (urgencia) {
    case 'fechado':
      return { urgencia, texto: ROTULO_STATUS[prazo.status] }
    case 'semdata':
      return { urgencia, texto: 'Sem data' }
    case 'vencido':
      return { urgencia, texto: `Vencido há ${-dias} ${dias === -1 ? 'dia' : 'dias'}` }
    case 'hoje':
      return { urgencia, texto: 'Vence hoje' }
    default:
      return { urgencia, texto: dias === 1 ? 'Amanhã' : `Em ${dias} dias` }
  }
}
