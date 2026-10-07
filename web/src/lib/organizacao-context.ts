import { createContext, useContext } from 'react'
import { pode, type Acao } from '../domain/permissoes'
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

/** O papel da pessoa na organização ativa permite a ação? (o RLS confere de novo no banco) */
export function usePode(): (acao: Acao) => boolean {
  const { papel } = usePertenca()
  return (acao) => pode(papel, acao)
}
