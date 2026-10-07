import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export interface EstadoAuth {
  /** `undefined` enquanto a sessão salva ainda está sendo lida. */
  sessao: Session | null | undefined
  sair: () => Promise<void>
}

export const AuthContext = createContext<EstadoAuth>({
  sessao: null,
  sair: async () => {},
})

export function useAuth(): EstadoAuth {
  return useContext(AuthContext)
}

/** Id do advogado logado; só use em telas protegidas pelo Layout. */
export function useUserId(): string {
  const { sessao } = useAuth()
  if (!sessao) throw new Error('Tela protegida usada sem sessão.')
  return sessao.user.id
}
