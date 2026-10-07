/**
 * Tipos do schema multitenant (supabase/schema.sql).
 * Regenerar com a Supabase CLI quando o schema mudar:
 *   supabase gen types typescript --project-id <projeto> > src/lib/database.types.ts
 */

export type StatusPrazo = 'pendente' | 'conferir' | 'cumprido' | 'arquivado'
export type TipoMonitoramento = 'oab' | 'processo'
export type StatusExecucao = 'ok' | 'falha'
export type Papel = 'dev' | 'advogado'

export type Json = string | number | boolean | null | { [chave: string]: Json | undefined } | Json[]

export type Configuracao = {
  user_id: string
  email_destino: string
  dias_retroativos: number
  prazo_padrao_dias: number
  dias_alerta: number
  considerar_recesso: boolean
  webhook_token: string
  ultima_busca_em: string | null
  updated_at: string
}

export type Monitoramento = {
  id: number
  user_id: string
  tipo: TipoMonitoramento
  oab_numero: string | null
  oab_uf: string | null
  numero_processo: string | null
  descricao: string | null
  ativo: boolean
  created_at: string
}

export type Feriado = {
  user_id: string
  data: string
  descricao: string
}

export type Prazo = {
  id: string
  user_id: string
  djen_id: string
  processo: string | null
  tribunal: string | null
  orgao: string | null
  tipo: string | null
  classe: string | null
  partes: string | null
  prazo_dias: number | null
  origem_prazo: string | null
  data_disponibilizacao: string | null
  data_publicacao: string | null
  inicio_prazo: string | null
  vencimento: string | null
  status: StatusPrazo
  link: string | null
  teor: string | null
  observacoes: string | null
  cumprido_em: string | null
  created_at: string
  updated_at: string
}

export type Execucao = {
  id: number
  user_id: string | null
  executado_em: string
  origem: string | null
  encontradas: number
  novas: number
  status: StatusExecucao
  detalhe: string | null
}

/** Linha única com o que vale para todos os advogados; só o dev altera. */
export type ConfiguracaoSistema = {
  id: number
  n8n_webhook_url: string
  updated_at: string
  updated_by: string | null
}

export type RegistroAuditoria = {
  id: number
  criado_em: string
  dev_id: string | null
  dev_email: string | null
  acao: string
  alvo_user_id: string | null
  alvo_email: string | null
  detalhe: Json
}

/** Retorno de `admin_listar_contas()`. */
export type ContaAdmin = {
  id: string
  email: string
  criado_em: string
  ultimo_acesso: string | null
  confirmado: boolean
  bloqueado: boolean
  app_role: string
  monitoramentos_ativos: number
  prazos_abertos: number
  prazos_vencidos: number
  ultima_execucao: string | null
  ultima_execucao_status: StatusExecucao | null
}

/** Retorno de `admin_metricas()`. */
export type MetricasAdmin = {
  contas: number
  devs: number
  contas_bloqueadas: number
  advogados_ativos: number
  monitoramentos_ativos: number
  prazos_total: number
  prazos_abertos: number
  prazos_vencidos: number
  prazos_conferir: number
  execucoes_24h: number
  falhas_24h: number
  ultima_execucao: string | null
  ultima_execucao_status: StatusExecucao | null
}

export type Database = {
  public: {
    Tables: {
      configuracoes: {
        Row: Configuracao
        Insert: Partial<Configuracao> & Pick<Configuracao, 'user_id'>
        Update: Partial<Configuracao>
        Relationships: []
      }
      monitoramentos: {
        Row: Monitoramento
        Insert: Partial<Omit<Monitoramento, 'id'>> & Pick<Monitoramento, 'tipo'>
        Update: Partial<Omit<Monitoramento, 'id'>>
        Relationships: []
      }
      feriados: {
        Row: Feriado
        Insert: Partial<Feriado> & Pick<Feriado, 'data'>
        Update: Partial<Feriado>
        Relationships: []
      }
      prazos: {
        Row: Prazo
        Insert: Partial<Prazo> & Pick<Prazo, 'djen_id'>
        Update: Partial<Prazo>
        Relationships: []
      }
      execucoes: {
        Row: Execucao
        Insert: Partial<Omit<Execucao, 'id'>>
        Update: Partial<Omit<Execucao, 'id'>>
        Relationships: []
      }
      configuracao_sistema: {
        Row: ConfiguracaoSistema
        Insert: Partial<ConfiguracaoSistema>
        Update: Partial<Pick<ConfiguracaoSistema, 'n8n_webhook_url'>>
        Relationships: []
      }
      auditoria: {
        Row: RegistroAuditoria
        Insert: Partial<Omit<RegistroAuditoria, 'id' | 'criado_em'>> & Pick<RegistroAuditoria, 'acao'>
        Update: Record<string, never>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_dev: { Args: Record<string, never>; Returns: boolean }
      admin_listar_contas: { Args: Record<string, never>; Returns: ContaAdmin[] }
      admin_metricas: { Args: Record<string, never>; Returns: MetricasAdmin }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
