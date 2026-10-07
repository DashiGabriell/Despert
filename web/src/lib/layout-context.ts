import { useOutletContext } from 'react-router-dom'
import type { DataISO } from '../domain/dias'
import type { Prazo } from './database.types'

export interface ContextoLayout {
  hoje: DataISO
  abrirPrazo: (prazo: Prazo) => void
  novoPrazo: (data?: DataISO) => void
}

export function useLayout(): ContextoLayout {
  return useOutletContext<ContextoLayout>()
}
