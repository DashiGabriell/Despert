import { FunctionsHttpError } from '@supabase/supabase-js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { urlDisparo } from '../domain/busca'
import type { Carencia } from '../domain/planos'
import type {
  Configuracao,
  ContaAdmin,
  Database,
  Execucao,
  MetricasAdmin,
  OrganizacaoAdmin,
  Plano,
  RegistroAuditoria,
  RotuloOrganizacao,
} from '../lib/database.types'
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
  organizacoes: ['admin', 'organizacoes'] as const,
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
        .is('membro_id', null)
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

export function useOrganizacoesAdmin() {
  return useQuery({
    queryKey: chavesAdmin.organizacoes,
    queryFn: async (): Promise<OrganizacaoAdmin[]> => {
      const { data, error } = await cliente().rpc('admin_listar_organizacoes')
      if (error) throw error
      return data ?? []
    },
  })
}

// ------------------------------------------------------------------ escrita

function useInvalidarOrganizacoes() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: chavesAdmin.organizacoes }),
      queryClient.invalidateQueries({ queryKey: chavesAdmin.auditoria }),
      queryClient.invalidateQueries({ queryKey: ['pertencas'] }),
    ])
}

/** Plano, ajustes, pagamento e dados da organização. Trocar de plano aplica o excesso no banco. */
export function useAtualizarOrganizacao() {
  const invalidar = useInvalidarOrganizacoes()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Database['public']['Tables']['organizacoes']['Update'] }) => {
      const { error } = await cliente().from('organizacoes').update(dados).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

export function useSalvarCarencia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (carencia: Carencia) => {
      const { error } = await cliente().from('configuracao_sistema').update(carencia).eq('id', 1)
      if (error) throw error
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: chaves.configuracaoSistema }),
        queryClient.invalidateQueries({ queryKey: chavesAdmin.auditoria }),
      ]),
  })
}

async function invocarAdmin<T>(pedido: AcaoAdmin): Promise<T> {
  const { data, error } = await cliente().functions.invoke('admin', { body: pedido })
  if (!error) return data as T
  if (error instanceof FunctionsHttpError) {
    const corpo: unknown = await error.context.json().catch(() => null)
    if (corpo && typeof corpo === 'object' && 'erro' in corpo && typeof corpo.erro === 'string') {
      throw new Error(corpo.erro)
    }
  }
  throw error
}

export interface NovaOrganizacao {
  nome: string
  rotulo: RotuloOrganizacao
  plano: Plano
  email: string
  senha: string
}

/**
 * Cria a conta do Administrador (que já nasce com a própria organização, em teste) e
 * transforma essa organização na contratada: nome, rótulo, plano e ativa.
 */
export function useCriarOrganizacao() {
  const invalidar = useInvalidarOrganizacoes()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (nova: NovaOrganizacao) => {
      const criada = await invocarAdmin<{ user_id?: string }>({
        acao: 'criar_conta',
        email: nova.email,
        senha: nova.senha,
        papel: 'advogado',
      })
      if (!criada.user_id) throw new Error('A conta foi criada, mas o servidor não informou o id.')
      const sb = cliente()
      const membro = await sb.from('membros').select('organizacao_id').eq('user_id', criada.user_id).maybeSingle()
      if (membro.error) throw membro.error
      if (!membro.data) throw new Error('A conta foi criada sem organização. Rode o schema.sql atualizado.')
      const { error } = await sb
        .from('organizacoes')
        .update({ nome: nova.nome, rotulo: nova.rotulo, plano: nova.plano, situacao: 'ativa' })
        .eq('id', membro.data.organizacao_id)
      if (error) throw error
    },
    onSuccess: () =>
      Promise.all([invalidar(), queryClient.invalidateQueries({ queryKey: chavesAdmin.contas })]),
  })
}

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
      await invocarAdmin(pedido)
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
      const { error } = await cliente().rpc('admin_trocar_token', { conta: userId, token })
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

/**
 * Dispara o robô para a organização (a mais antiga) da conta, como o Buscar agora: registra o
 * disparo (o robô só aceita token com registro recente), chama o webhook e audita.
 */
export function useDispararBusca() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (pedido: {
      webhookUrl: string
      conta: { id: string; email: string }
      dev: { id: string; email: string | undefined }
    }): Promise<number | null> => {
      const sb = cliente()
      const org = await sb.rpc('organizacao_de', { uid: pedido.conta.id })
      if (org.error) throw org.error
      if (!org.data) throw new Error('Esta conta não pertence a nenhuma organização.')
      const { data, error } = await sb
        .from('configuracoes_organizacao')
        .select('webhook_token')
        .eq('organizacao_id', org.data)
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('A organização desta conta ainda não tem configurações.')
      const registro = await sb.rpc('registrar_busca_agora', { org: org.data })
      if (registro.error) throw registro.error
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
