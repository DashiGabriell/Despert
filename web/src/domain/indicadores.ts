import type { DataISO } from './dias'
import { classificarUrgencia, emAberto, precisaConferir, type PrazoUrgencia } from './urgencia'

export interface Indicadores {
  vencido: number
  hoje: number
  semana: number
  conferir: number
  abertos: number
}

/** Os cinco números do topo da lista, sempre calculados sobre os prazos em aberto. */
export function contarIndicadores(prazos: readonly PrazoUrgencia[], hoje: DataISO): Indicadores {
  const contagem: Indicadores = { vencido: 0, hoje: 0, semana: 0, conferir: 0, abertos: 0 }
  for (const prazo of prazos) {
    if (!emAberto(prazo)) continue
    contagem.abertos++
    const urgencia = classificarUrgencia(prazo, hoje)
    if (urgencia === 'vencido') contagem.vencido++
    if (urgencia === 'hoje') contagem.hoje++
    if (urgencia === 'hoje' || urgencia === 'urgente' || urgencia === 'proximo') contagem.semana++
    if (precisaConferir(prazo)) contagem.conferir++
  }
  return contagem
}
