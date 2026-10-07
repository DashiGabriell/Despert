import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext } from '../lib/auth-context'
import { supabase } from '../lib/supabase'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [sessao, setSessao] = useState<Session | null | undefined>(supabase ? undefined : null)

  useEffect(() => {
    if (!supabase) return
    let ativo = true
    supabase.auth.getSession().then(({ data }) => {
      if (ativo) setSessao(data.session)
    })
    const { data } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      if (evento === 'SIGNED_OUT') queryClient.clear()
      setSessao(novaSessao)
    })
    return () => {
      ativo = false
      data.subscription.unsubscribe()
    }
  }, [queryClient])

  const sair = useCallback(async () => {
    await supabase?.auth.signOut()
    queryClient.clear()
    setSessao(null)
  }, [queryClient])

  const valor = useMemo(() => ({ sessao, sair }), [sessao, sair])
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
