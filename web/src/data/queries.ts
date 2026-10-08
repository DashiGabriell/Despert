import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type {
  BuscaAgora,
  Configuracao,
  ConfiguracaoOrganizacao,
  ConfiguracaoSistema,
  Convite,
  Database,
  Execucao,
  Feriado,
  MembroComOrganizacao,
  MembroDaEquipe,
  Monitoramento,
  AlteracaoPrazo,
  PapelMembro,
  Prazo,
  RegistroAuditoria,
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
  configuracaoOrganizacao: (orgId: string) => ['configuracao-organizacao', orgId] as const,
  configuracaoSistema: ['configuracao-sistema'] as const,
  membros: (orgId: string) => ['membros', orgId] as const,
  convites: (orgId: string) => ['convites', orgId] as const,
  buscasAgora: (orgId: string) => ['buscas-agora', orgId] as const,
  auditoria: (orgId: string) => ['auditoria', orgId] as const,
  alteracoesPrazo: (prazoId: string) => ['alteracoes-prazo', prazoId] as const,
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

/** Equipe da organização com o e-mail de cada membro (qualquer membro lê). */
export function useMembros(orgId: string) {
  return useQuery({
    queryKey: chaves.membros(orgId),
    queryFn: async (): Promise<MembroDaEquipe[]> => {
      const { data, error } = await cliente().rpc('membros_da_organizacao', { org: orgId })
      if (error) throw error
      return data
    },
  })
}

/** Convites da organização (o RLS só devolve para o Administrador). */
export function useConvites(orgId: string, ativo = true) {
  return useQuery({
    queryKey: chaves.convites(orgId),
    enabled: ativo,
    queryFn: async (): Promise<Convite[]> => {
      const { data, error } = await cliente()
        .from('convites')
        .select('*')
        .eq('organizacao_id', orgId)
        .is('aceito_em', null)
        .order('criado_em', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useConfiguracaoOrganizacao(orgId: string) {
  return useQuery({
    queryKey: chaves.configuracaoOrganizacao(orgId),
    queryFn: async (): Promise<ConfiguracaoOrganizacao | null> => {
      const { data, error } = await cliente()
        .from('configuracoes_organizacao')
        .select('*')
        .eq('organizacao_id', orgId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Disparos do Buscar agora da organização nos últimos 2 dias (cota do dia e intervalo mínimo). */
export function useBuscasAgora(orgId: string) {
  return useQuery({
    queryKey: chaves.buscasAgora(orgId),
    queryFn: async (): Promise<BuscaAgora[]> => {
      const { data, error } = await cliente()
        .from('buscas_agora')
        .select('*')
        .eq('organizacao_id', orgId)
        .gte('criado_em', new Date(Date.now() - 2 * 86_400_000).toISOString())
        .order('criado_em', { ascending: false })
      if (error) throw error
      return data
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
        .from('feriados_organizacao')
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

export interface Periodo {
  de?: string
  ate?: string
}

/** Auditoria da organização no período (o RLS só devolve ao Administrador, nos planos com auditoria). */
export function useAuditoriaDaOrganizacao(orgId: string, periodo: Periodo, ativo = true) {
  return useQuery({
    queryKey: [...chaves.auditoria(orgId), periodo.de ?? '', periodo.ate ?? ''],
    enabled: ativo,
    queryFn: async (): Promise<RegistroAuditoria[]> => {
      let consulta = cliente().from('auditoria').select('*').eq('organizacao_id', orgId)
      if (periodo.de) consulta = consulta.gte('criado_em', periodo.de)
      if (periodo.ate) consulta = consulta.lt('criado_em', periodo.ate)
      const { data, error } = await consulta.order('criado_em', { ascending: false }).limit(500)
      if (error) throw error
      return data
    },
  })
}

/** Quem cumpriu, mudou vencimento ou responsável (o banco recusa nos planos sem auditoria). */
export function useAlteracoesDoPrazo(prazoId: string, ativo = true) {
  return useQuery({
    queryKey: chaves.alteracoesPrazo(prazoId),
    enabled: ativo,
    queryFn: async (): Promise<AlteracaoPrazo[]> => {
      const { data, error } = await cliente().rpc('alteracoes_do_prazo', { prazo: prazoId })
      if (error) throw error
      return data
    },
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
        .insert({ user_id: userId, ...registro, organizacao_id: orgId, ativo: true })
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

/** O banco confere intervalo, cota diária e etapa da organização antes de registrar. */
export function useRegistrarBuscaAgora(orgId: string) {
  const invalidar = useInvalidar(chaves.buscasAgora(orgId))
  return useMutation({
    mutationFn: async (): Promise<number> => {
      const { data, error } = await cliente().rpc('registrar_busca_agora', { org: orgId })
      if (error) throw error
      return data
    },
    onSettled: invalidar,
  })
}

export function useCancelarBuscaAgora(orgId: string) {
  const invalidar = useInvalidar(chaves.buscasAgora(orgId))
  return useMutation({
    mutationFn: async (busca: number) => {
      const { error } = await cliente().rpc('cancelar_busca_agora', { busca })
      if (error) throw error
    },
    onSettled: invalidar,
  })
}

/** Só o que é pessoal: e-mail, janela de alerta e escopo do resumo. */
export function useSalvarConfiguracao(userId: string) {
  const invalidar = useInvalidar(chaves.configuracao(userId))
  return useMutation({
    mutationFn: async (dados: Pick<Tabelas['configuracoes']['Update'], 'email_destino' | 'dias_alerta' | 'resumo_escopo'>) => {
      const { error } = await cliente()
        .from('configuracoes')
        .update(dados)
        .eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

/** O banco copia as mudanças para a configuração de cada membro (lida pelo robô). */
export function useSalvarConfiguracaoOrganizacao(orgId: string, userId: string) {
  const invalidar = useInvalidar(chaves.configuracaoOrganizacao(orgId), chaves.configuracao(userId))
  return useMutation({
    mutationFn: async (dados: Tabelas['configuracoes_organizacao']['Update']) => {
      const { error } = await cliente()
        .from('configuracoes_organizacao')
        .update({ ...dados, updated_at: new Date().toISOString() })
        .eq('organizacao_id', orgId)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

export function useCriarFeriado(orgId: string) {
  const invalidar = useInvalidar(chaves.feriados(orgId))
  return useMutation({
    mutationFn: async (feriado: { data: string; descricao: string }) => {
      const { error } = await cliente()
        .from('feriados_organizacao')
        .insert({ ...feriado, organizacao_id: orgId })
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
        .from('feriados_organizacao')
        .delete()
        .eq('organizacao_id', orgId)
        .eq('data', data)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

// ------------------------------------------------------------------ exportação
// O banco confere papel e plano e registra a exportação na auditoria.

export function useExportarPrazos(orgId: string) {
  const invalidar = useInvalidar(chaves.auditoria(orgId))
  return useMutation({
    mutationFn: async (): Promise<Prazo[]> => {
      const { data, error } = await cliente().rpc('exportar_prazos', { org: orgId })
      if (error) throw error
      return data
    },
    onSuccess: invalidar,
  })
}

export function useExportarAuditoria(orgId: string) {
  const invalidar = useInvalidar(chaves.auditoria(orgId))
  return useMutation({
    mutationFn: async (periodo: Periodo): Promise<RegistroAuditoria[]> => {
      const { data, error } = await cliente().rpc('exportar_auditoria', { org: orgId, ...periodo })
      if (error) throw error
      return data
    },
    onSuccess: invalidar,
  })
}

// ------------------------------------------------------------------ equipe
// Tudo passa por funções do banco, que conferem papel, vagas do plano e o último Administrador.

export function useConvidar(orgId: string) {
  const invalidar = useInvalidar(chaves.convites(orgId))
  return useMutation({
    mutationFn: async (convite: { email: string; papel: PapelMembro }): Promise<Convite> => {
      const { data, error } = await cliente().rpc('convidar', {
        org: orgId,
        email_convidado: convite.email,
        papel_convidado: convite.papel,
      })
      if (error) throw error
      return data
    },
    onSuccess: invalidar,
  })
}

export function useReenviarConvite(orgId: string) {
  const invalidar = useInvalidar(chaves.convites(orgId))
  return useMutation({
    mutationFn: async (convite: string): Promise<Convite> => {
      const { data, error } = await cliente().rpc('reenviar_convite', { convite })
      if (error) throw error
      return data
    },
    onSuccess: invalidar,
  })
}

export function useCancelarConvite(orgId: string) {
  const invalidar = useInvalidar(chaves.convites(orgId))
  return useMutation({
    mutationFn: async (convite: string) => {
      const { error } = await cliente().rpc('cancelar_convite', { convite })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

/** Rebaixar para Assistente ou Leitura pausa a OAB da pessoa (no banco). */
export function useAlterarPapel(orgId: string) {
  const invalidar = useInvalidar(chaves.membros(orgId), chaves.monitoramentos(orgId))
  return useMutation({
    mutationFn: async ({ membro, papel }: { membro: string; papel: PapelMembro }) => {
      const { error } = await cliente().rpc('alterar_papel', { org: orgId, membro, novo_papel: papel })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

/** Na saída, o banco pausa a OAB e passa os prazos em aberto para o Administrador. */
export function useRemoverMembro(orgId: string) {
  const invalidar = useInvalidar(chaves.membros(orgId), chaves.monitoramentos(orgId), chaves.prazos(orgId))
  return useMutation({
    mutationFn: async (membro: string) => {
      const { error } = await cliente().rpc('remover_membro', { org: orgId, membro })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}
