import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type {
  Configuracao,
  ConfiguracaoSistema,
  Database,
  Execucao,
  Feriado,
  Monitoramento,
  Prazo,
} from '../lib/database.types'
import { ausenciaConfiguracao, supabase } from '../lib/supabase'

type Tabelas = Database['public']['Tables']

export function cliente() {
  if (!supabase) throw new Error(ausenciaConfiguracao ?? 'Supabase não configurado.')
  return supabase
}

export const chaves = {
  prazos: (userId: string) => ['prazos', userId] as const,
  monitoramentos: (userId: string) => ['monitoramentos', userId] as const,
  feriados: (userId: string) => ['feriados', userId] as const,
  execucoes: (userId: string) => ['execucoes', userId] as const,
  configuracao: (userId: string) => ['configuracao', userId] as const,
  configuracaoSistema: ['configuracao-sistema'] as const,
}

/** Configuração global (URL do webhook do n8n): todos leem, só o dev altera. */
export function useConfiguracaoSistema() {
  return useQuery({
    queryKey: chaves.configuracaoSistema,
    queryFn: async (): Promise<ConfiguracaoSistema | null> => {
      const { data, error } = await cliente().from('configuracao_sistema').select('*').eq('id', 1).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

// ------------------------------------------------------------------ leitura

export function usePrazos(userId: string) {
  return useQuery({
    queryKey: chaves.prazos(userId),
    queryFn: async (): Promise<Prazo[]> => {
      const { data, error } = await cliente()
        .from('prazos')
        .select('*')
        .eq('user_id', userId)
        .order('vencimento', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
        .limit(5000)
      if (error) throw error
      return data
    },
  })
}

export function useMonitoramentos(userId: string) {
  return useQuery({
    queryKey: chaves.monitoramentos(userId),
    queryFn: async (): Promise<Monitoramento[]> => {
      const { data, error } = await cliente()
        .from('monitoramentos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useFeriados(userId: string) {
  return useQuery({
    queryKey: chaves.feriados(userId),
    queryFn: async (): Promise<Feriado[]> => {
      const { data, error } = await cliente()
        .from('feriados')
        .select('*')
        .eq('user_id', userId)
        .order('data', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useExecucoes(userId: string, opcoes: { acompanhar?: boolean } = {}) {
  return useQuery({
    queryKey: chaves.execucoes(userId),
    queryFn: async (): Promise<Execucao[]> => {
      const { data, error } = await cliente()
        .from('execucoes')
        .select('*')
        .eq('user_id', userId)
        .order('executado_em', { ascending: false })
        .limit(100)
      if (error) throw error
      return data
    },
    // Enquanto uma busca está em andamento, consulta também por intervalo caso o tempo real atrase.
    refetchInterval: opcoes.acompanhar ? 5000 : false,
  })
}

export function useConfiguracao(userId: string, email: string | undefined) {
  return useQuery({
    queryKey: chaves.configuracao(userId),
    queryFn: async (): Promise<Configuracao> => {
      const sb = cliente()
      const { data, error } = await sb
        .from('configuracoes')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      if (data) return data
      // Contas criadas antes do gatilho de cadastro não têm linha: cria a padrão.
      const criada = await sb
        .from('configuracoes')
        .insert({ user_id: userId, email_destino: email ?? '' })
        .select('*')
        .single()
      if (criada.error) throw criada.error
      return criada.data
    },
  })
}

// ------------------------------------------------------------------ tempo real

/** Recarrega prazos e execuções quando o robô grava algo para este advogado. */
export function useTempoReal(userId: string) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!supabase) return
    const sb = supabase
    const filtro = `user_id=eq.${userId}`
    const canal = sb
      .channel(`despert-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prazos', filter: filtro }, () => {
        queryClient.invalidateQueries({ queryKey: chaves.prazos(userId) })
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'execucoes', filter: filtro },
        () => {
          queryClient.invalidateQueries({ queryKey: chaves.execucoes(userId) })
          queryClient.invalidateQueries({ queryKey: chaves.prazos(userId) })
        },
      )
      .subscribe()
    return () => {
      sb.removeChannel(canal)
    }
  }, [userId, queryClient])
}

// ------------------------------------------------------------------ escrita

function useInvalidar(...chavesAlvo: (readonly unknown[])[]) {
  const queryClient = useQueryClient()
  return () => Promise.all(chavesAlvo.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}

export function useAtualizarPrazo(userId: string) {
  const invalidar = useInvalidar(chaves.prazos(userId))
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Tabelas['prazos']['Update'] }) => {
      const { error } = await cliente().from('prazos').update(dados).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

export function useCriarPrazo(userId: string) {
  const invalidar = useInvalidar(chaves.prazos(userId))
  return useMutation({
    mutationFn: async (registro: Tabelas['prazos']['Insert']) => {
      const { error } = await cliente()
        .from('prazos')
        .insert({ ...registro, user_id: userId })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

export function useExcluirPrazo(userId: string) {
  const invalidar = useInvalidar(chaves.prazos(userId))
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await cliente().from('prazos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

export function useCriarMonitoramento(userId: string) {
  const invalidar = useInvalidar(chaves.monitoramentos(userId))
  return useMutation({
    mutationFn: async (registro: Tabelas['monitoramentos']['Insert']) => {
      const { error } = await cliente()
        .from('monitoramentos')
        .insert({ ...registro, user_id: userId, ativo: true })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

export function useAlternarMonitoramento(userId: string) {
  const invalidar = useInvalidar(chaves.monitoramentos(userId))
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: number; ativo: boolean }) => {
      const { error } = await cliente().from('monitoramentos').update({ ativo }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

export function useRemoverMonitoramento(userId: string) {
  const invalidar = useInvalidar(chaves.monitoramentos(userId))
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await cliente().from('monitoramentos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

export function useSalvarConfiguracao(userId: string) {
  const invalidar = useInvalidar(chaves.configuracao(userId))
  return useMutation({
    mutationFn: async (dados: Tabelas['configuracoes']['Update']) => {
      const { error } = await cliente()
        .from('configuracoes')
        .update(dados)
        .eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

export function useCriarFeriado(userId: string) {
  const invalidar = useInvalidar(chaves.feriados(userId))
  return useMutation({
    mutationFn: async (feriado: { data: string; descricao: string }) => {
      const { error } = await cliente()
        .from('feriados')
        .insert({ ...feriado, user_id: userId })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

export function useRemoverFeriado(userId: string) {
  const invalidar = useInvalidar(chaves.feriados(userId))
  return useMutation({
    mutationFn: async (data: string) => {
      const { error } = await cliente()
        .from('feriados')
        .delete()
        .eq('user_id', userId)
        .eq('data', data)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}
