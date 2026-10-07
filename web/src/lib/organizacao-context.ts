import { createContext, useContext } from 'react'
import type { MembroComOrganizacao } from './database.types'

/** Pertença ativa da pessoa (ou do advogado que o dev representa); definida pelo Layout. */
export const OrganizacaoContext = createContext<MembroComOrganizacao | null>(null)

export function usePertenca(): MembroComOrganizacao {
  const pertenca = useContext(OrganizacaoContext)
  if (!pertenca) throw new Error('Tela protegida usada sem organização.')
  return pertenca
}

/** Id da organização dona dos dados mostrados na tela. */
export function useOrganizacaoId(): string {
  return usePertenca().organizacao_id
}
