import { FunctionsHttpError } from '@supabase/supabase-js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { urlDisparo } from '../domain/busca'
import type { Configuracao, ContaAdmin, Execucao, MetricasAdmin, RegistroAuditoria } from '../lib/database.types'
import { chaves, cliente } from './queries'

/**
 * GET no webhook como o botão Buscar agora faz (ADR-0004). Devolve o status HTTP, ou `null`
 * quando o navegador não deixa ler a resposta (CORS) mas a requisição saiu.
 */
export async function chamarWebhook(url: string): Promise<number | null> {
  try {
    const resposta = await fetch(url, { method: 'GET' })
    return resposta.status
  } catch {
    await fetch(url, { method: 'GET', mode: 'no-cors' })
    return null
  }
}

export const chavesAdmin = {
  contas: ['admin', 'contas'] as const,
  metricas: ['admin', 'metricas'] as const,
  execucoes: ['admin', 'execucoes'] as const,
  auditoria: ['admin', 'auditoria'] as const,
  configuracao: (userId: string) => ['admin', 'configuracao', userId] as const,
}

// ------------------------------------------------------------------ leitura

export function useContasAdmin() {
  return useQuery({
    queryKey: chavesAdmin.contas,
    queryFn: async (): Promise<ContaAdmin[]> => {
      const { data, error } = await cliente().rpc('admin_listar_contas')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useMetricasAdmin() {
  return useQuery({
    queryKey: chavesAdmin.metricas,
    queryFn: async (): Promise<MetricasAdmin> => {
      const { data, error } = await cliente().rpc('admin_metricas')
      if (error) throw error
      return data
    },
    refetchInterval: 60_000,
  })
}

/** Execuções de todos os advogados, inclusive as falhas gerais (sem `user_id`). */
export function useExecucoesGlobais() {
  return useQuery({
    queryKey: chavesAdmin.execucoes,
    queryFn: async (): Promise<Execucao[]> => {
      const { data, error } = await cliente()
        .from('execucoes')
        .select('*')
        .order('executado_em', { ascending: false })
        .limit(300)
      if (error) throw error
      return data
    },
    refetchInterval: 30_000,
  })
}

export function useAuditoria() {
  return useQuery({
    queryKey: chavesAdmin.auditoria,
    queryFn: async (): Promise<RegistroAuditoria[]> => {
      const { data, error } = await cliente()
        .from('auditoria')
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(300)
      if (error) throw error
      return data
    },
  })
}

/** Configuração de um advogado só para leitura: não cria a linha padrão como `useConfiguracao`. */
export function useConfiguracaoDaConta(userId: string) {
  return useQuery({
    queryKey: chavesAdmin.configuracao(userId),
    queryFn: async (): Promise<Configuracao | null> => {
      const { data, error } = await cliente()
        .from('configuracoes')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

// ------------------------------------------------------------------ escrita

export function useSalvarWebhookSistema() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (url: string) => {
      const { error } = await cliente()
        .from('configuracao_sistema')
        .update({ n8n_webhook_url: url })
        .eq('id', 1)
      if (error) throw error
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: chaves.configuracaoSistema }),
        queryClient.invalidateQueries({ queryKey: chavesAdmin.auditoria }),
      ]),
  })
}

export type AcaoAdmin =
  | { acao: 'criar_conta'; email: string; senha: string; papel: 'dev' | 'advogado' }
  | { acao: 'redefinir_senha'; user_id: string; senha: string }
  | { acao: 'bloquear' | 'desbloquear' | 'excluir_conta'; user_id: string }
  | { acao: 'definir_papel'; user_id: string; papel: 'dev' | 'advogado' }

/** Ações que exigem a service_role: passam pela Edge Function `admin`. */
export function useAcaoAdmin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (pedido: AcaoAdmin) => {
      const { error } = await cliente().functions.invoke('admin', { body: pedido })
      if (!error) return
      if (error instanceof FunctionsHttpError) {
        const corpo: unknown = await error.context.json().catch(() => null)
        if (corpo && typeof corpo === 'object' && 'erro' in corpo && typeof corpo.erro === 'string') {
          throw new Error(corpo.erro)
        }
      }
      throw error
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: chavesAdmin.contas }),
        queryClient.invalidateQueries({ queryKey: chavesAdmin.metricas }),
        queryClient.invalidateQueries({ queryKey: chavesAdmin.auditoria }),
      ]),
  })
}

/** Troca o token do webhook de um advogado (invalida o anterior na hora). */
export function useGerarTokenAdvogado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, token }: { userId: string; token: string }) => {
      const { error } = await cliente()
        .from('configuracoes')
        .update({ webhook_token: token })
        .eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: (_, { userId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: chaves.configuracao(userId) }),
        queryClient.invalidateQueries({ queryKey: chavesAdmin.configuracao(userId) }),
        queryClient.invalidateQueries({ queryKey: chavesAdmin.auditoria }),
      ]),
  })
}

/** Dispara uma execução do robô para um advogado, com o token dele, e registra na auditoria. */
export function useDispararBusca() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (pedido: {
      webhookUrl: string
      conta: { id: string; email: string }
      dev: { id: string; email: string | undefined }
    }): Promise<number | null> => {
      const sb = cliente()
      const { data, error } = await sb
        .from('configuracoes')
        .select('webhook_token')
        .eq('user_id', pedido.conta.id)
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Este advogado ainda não tem configuração (nunca entrou no site).')
      const status = await chamarWebhook(urlDisparo(pedido.webhookUrl, data.webhook_token))
      await sb.from('auditoria').insert({
        dev_id: pedido.dev.id,
        dev_email: pedido.dev.email ?? null,
        acao: 'disparar_busca',
        alvo_user_id: pedido.conta.id,
        alvo_email: pedido.conta.email,
      })
      return status
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: chavesAdmin.auditoria }),
        queryClient.invalidateQueries({ queryKey: chavesAdmin.execucoes }),
      ]),
  })
}

/** Ações do dev que não passam por gatilho do banco (ex.: entrar como advogado). */
export function useRegistrarAuditoria() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (registro: {
      devId: string
      devEmail: string | undefined
      acao: string
      alvoUserId?: string
      alvoEmail?: string
    }) => {
      const { error } = await cliente()
        .from('auditoria')
        .insert({
          dev_id: registro.devId,
          dev_email: registro.devEmail ?? null,
          acao: registro.acao,
          alvo_user_id: registro.alvoUserId ?? null,
          alvo_email: registro.alvoEmail ?? null,
        })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chavesAdmin.auditoria }),
  })
}
