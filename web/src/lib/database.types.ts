/**
 * Tipos do schema multitenant (supabase/schema.sql).
 * Regenerar com a Supabase CLI quando o schema mudar:
 *   supabase gen types typescript --project-id <projeto> > src/lib/database.types.ts
 */

export type StatusPrazo = 'pendente' | 'conferir' | 'cumprido' | 'arquivado'
export type TipoMonitoramento = 'oab' | 'processo'
export type StatusExecucao = 'ok' | 'falha'

export type Configuracao = {
  user_id: string
  email_destino: string
  dias_retroativos: number
  prazo_padrao_dias: number
  dias_alerta: number
  considerar_recesso: boolean
  n8n_webhook_url: string
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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
