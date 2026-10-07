import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { lerAtuacao, papelDe, type Atuacao } from '../domain/acesso'
import { AuthContext } from '../lib/auth-context'
import type { Papel } from '../lib/database.types'
import { supabase } from '../lib/supabase'

const CHAVE_ATUACAO = 'despert:atuacao'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [sessao, setSessao] = useState<Session | null | undefined>(supabase ? undefined : null)
  const [atuacaoSalva, setAtuacaoSalva] = useState<Atuacao | null>(() =>
    lerAtuacao(sessionStorage.getItem(CHAVE_ATUACAO)),
  )

  const encerrarAtuacao = useCallback(() => {
    sessionStorage.removeItem(CHAVE_ATUACAO)
    setAtuacaoSalva(null)
  }, [])

  const iniciarAtuacao = useCallback((atuacao: Atuacao) => {
    sessionStorage.setItem(CHAVE_ATUACAO, JSON.stringify(atuacao))
    setAtuacaoSalva(atuacao)
  }, [])

  useEffect(() => {
    if (!supabase) return
    let ativo = true
    supabase.auth.getSession().then(({ data }) => {
      if (ativo) setSessao(data.session)
    })
    const { data } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      if (evento === 'SIGNED_OUT') {
        queryClient.clear()
        encerrarAtuacao()
      }
      setSessao(novaSessao)
    })
    return () => {
      ativo = false
      data.subscription.unsubscribe()
    }
  }, [queryClient, encerrarAtuacao])

  const sair = useCallback(async () => {
    await supabase?.auth.signOut()
    queryClient.clear()
    encerrarAtuacao()
    setSessao(null)
  }, [queryClient, encerrarAtuacao])

  // O app_metadata da sessão salva fica velho até o token renovar; o banco é quem decide o papel.
  const userId = sessao?.user.id
  const papelNoBanco = useQuery({
    queryKey: ['papel', userId],
    enabled: Boolean(supabase && userId),
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async (): Promise<Papel> => {
      const { data, error } = await supabase!.rpc('is_dev')
      if (error) throw error
      return data ? 'dev' : 'advogado'
    },
  })
  const conferindoPapel = Boolean(userId) && papelNoBanco.isPending
  const sessaoPronta = conferindoPapel ? undefined : sessao
  const papel = papelNoBanco.data ?? papelDe(sessao?.user)
  const atuacao = papel === 'dev' ? atuacaoSalva : null

  const valor = useMemo(
    () => ({ sessao: sessaoPronta, sair, papel, atuacao, iniciarAtuacao, encerrarAtuacao }),
    [sessaoPronta, sair, papel, atuacao, iniciarAtuacao, encerrarAtuacao],
  )
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
