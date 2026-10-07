import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type {
  Configuracao,
  ConfiguracaoSistema,
  Database,
  Execucao,
  Feriado,
  MembroComOrganizacao,
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
  pertencas: (userId: string) => ['pertencas', userId] as const,
  prazos: (orgId: string) => ['prazos', orgId] as const,
  monitoramentos: (orgId: string) => ['monitoramentos', orgId] as const,
  feriados: (orgId: string) => ['feriados', orgId] as const,
  execucoes: (orgId: string) => ['execucoes', orgId] as const,
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

/** Organizações das quais a pessoa é membro, com os dados de cada uma. */
export function usePertencas(userId: string) {
  return useQuery({
    queryKey: chaves.pertencas(userId),
    queryFn: async (): Promise<MembroComOrganizacao[]> => {
      const sb = cliente()
      const membros = await sb.from('membros').select('*').eq('user_id', userId)
      if (membros.error) throw membros.error
      if (membros.data.length === 0) return []
      const organizacoes = await sb
        .from('organizacoes')
        .select('*')
        .in(
          'id',
          membros.data.map((m) => m.organizacao_id),
        )
      if (organizacoes.error) throw organizacoes.error
      const porId = new Map(organizacoes.data.map((o) => [o.id, o]))
      return membros.data.flatMap((m) => {
        const organizacao = porId.get(m.organizacao_id)
        return organizacao ? [{ ...m, organizacao }] : []
      })
    },
  })
}

export function usePrazos(orgId: string) {
  return useQuery({
    queryKey: chaves.prazos(orgId),
    queryFn: async (): Promise<Prazo[]> => {
      const { data, error } = await cliente()
        .from('prazos')
        .select('*')
        .eq('organizacao_id', orgId)
        .order('vencimento', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
        .limit(5000)
      if (error) throw error
      return data
    },
  })
}

export function useMonitoramentos(orgId: string) {
  return useQuery({
    queryKey: chaves.monitoramentos(orgId),
    queryFn: async (): Promise<Monitoramento[]> => {
      const { data, error } = await cliente()
        .from('monitoramentos')
        .select('*')
        .eq('organizacao_id', orgId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useFeriados(orgId: string) {
  return useQuery({
    queryKey: chaves.feriados(orgId),
    queryFn: async (): Promise<Feriado[]> => {
      const { data, error } = await cliente()
        .from('feriados')
        .select('*')
        .eq('organizacao_id', orgId)
        .order('data', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useExecucoes(orgId: string, opcoes: { acompanhar?: boolean } = {}) {
  return useQuery({
    queryKey: chaves.execucoes(orgId),
    queryFn: async (): Promise<Execucao[]> => {
      const { data, error } = await cliente()
        .from('execucoes')
        .select('*')
        .eq('organizacao_id', orgId)
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

/** Recarrega prazos e execuções quando o robô grava algo para esta organização. */
export function useTempoReal(orgId: string) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!supabase) return
    const sb = supabase
    const filtro = `organizacao_id=eq.${orgId}`
    const canal = sb
      .channel(`despert-${orgId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prazos', filter: filtro }, () => {
        queryClient.invalidateQueries({ queryKey: chaves.prazos(orgId) })
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'execucoes', filter: filtro },
        () => {
          queryClient.invalidateQueries({ queryKey: chaves.execucoes(orgId) })
          queryClient.invalidateQueries({ queryKey: chaves.prazos(orgId) })
        },
      )
      .subscribe()
    return () => {
      sb.removeChannel(canal)
    }
  }, [orgId, queryClient])
}

// ------------------------------------------------------------------ escrita

function useInvalidar(...chavesAlvo: (readonly unknown[])[]) {
  const queryClient = useQueryClient()
  return () => Promise.all(chavesAlvo.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}

export function useAtualizarPrazo(orgId: string) {
  const invalidar = useInvalidar(chaves.prazos(orgId))
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Tabelas['prazos']['Update'] }) => {
      const { error } = await cliente().from('prazos').update(dados).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

/** `userId` é o autor, que também fica como responsável pelo prazo. */
export function useCriarPrazo(orgId: string, userId: string) {
  const invalidar = useInvalidar(chaves.prazos(orgId))
  return useMutation({
    mutationFn: async (registro: Tabelas['prazos']['Insert']) => {
      const { error } = await cliente()
        .from('prazos')
        .insert({ ...registro, organizacao_id: orgId, user_id: userId, responsavel_id: userId })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

export function useExcluirPrazo(orgId: string) {
  const invalidar = useInvalidar(chaves.prazos(orgId))
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await cliente().from('prazos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

export function useCriarMonitoramento(orgId: string, userId: string) {
  const invalidar = useInvalidar(chaves.monitoramentos(orgId))
  return useMutation({
    mutationFn: async (registro: Tabelas['monitoramentos']['Insert']) => {
      const { error } = await cliente()
        .from('monitoramentos')
        .insert({ ...registro, organizacao_id: orgId, user_id: userId, ativo: true })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

export function useAlternarMonitoramento(orgId: string) {
  const invalidar = useInvalidar(chaves.monitoramentos(orgId))
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: number; ativo: boolean }) => {
      const { error } = await cliente().from('monitoramentos').update({ ativo }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

export function useRemoverMonitoramento(orgId: string) {
  const invalidar = useInvalidar(chaves.monitoramentos(orgId))
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

export function useCriarFeriado(orgId: string, userId: string) {
  const invalidar = useInvalidar(chaves.feriados(orgId))
  return useMutation({
    mutationFn: async (feriado: { data: string; descricao: string }) => {
      const { error } = await cliente()
        .from('feriados')
        .insert({ ...feriado, organizacao_id: orgId, user_id: userId })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

export function useRemoverFeriado(orgId: string) {
  const invalidar = useInvalidar(chaves.feriados(orgId))
  return useMutation({
    mutationFn: async (data: string) => {
      const { error } = await cliente()
        .from('feriados')
        .delete()
        .eq('organizacao_id', orgId)
        .eq('data', data)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}
