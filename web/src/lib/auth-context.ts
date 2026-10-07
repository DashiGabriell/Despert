import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import type { Atuacao } from '../domain/acesso'
import type { Papel } from './database.types'

export interface EstadoAuth {
  /** `undefined` enquanto a sessão salva é lida ou o papel ainda está sendo conferido no banco. */
  sessao: Session | null | undefined
  sair: () => Promise<void>
  papel: Papel
  /** Advogado que o dev está representando; sempre `null` para quem não é dev. */
  atuacao: Atuacao | null
  iniciarAtuacao: (atuacao: Atuacao) => void
  encerrarAtuacao: () => void
}

export const AuthContext = createContext<EstadoAuth>({
  sessao: null,
  sair: async () => {},
  papel: 'advogado',
  atuacao: null,
  iniciarAtuacao: () => {},
  encerrarAtuacao: () => {},
})

export function useAuth(): EstadoAuth {
  return useContext(AuthContext)
}

/**
 * Id do advogado cujos dados a tela mostra: o da sessão ou, quando o dev está atuando,
 * o do advogado representado. Só use em telas protegidas pelo Layout.
 */
export function useUserId(): string {
  const { sessao, atuacao } = useAuth()
  if (!sessao) throw new Error('Tela protegida usada sem sessão.')
  return atuacao?.userId ?? sessao.user.id
}

/** E-mail correspondente a `useUserId()`. */
export function useEmailEfetivo(): string | undefined {
  const { sessao, atuacao } = useAuth()
  return atuacao?.email ?? sessao?.user.email
}
