/**
 * Tipos do schema multitenant (supabase/schema.sql).
 * Regenerar com a Supabase CLI quando o schema mudar:
 *   supabase gen types typescript --project-id <projeto> > src/lib/database.types.ts
 */

export type StatusPrazo = 'pendente' | 'conferir' | 'cumprido' | 'arquivado'
export type TipoMonitoramento = 'oab' | 'processo'
export type StatusExecucao = 'ok' | 'falha'
export type Papel = 'dev' | 'advogado'
export type PapelMembro = 'administrador' | 'advogado' | 'assistente' | 'leitura'
export type RotuloOrganizacao = 'escritorio' | 'departamento_juridico'
export type Plano = 'solo' | 'escritorio' | 'corporativo'
export type SituacaoOrganizacao = 'teste' | 'ativa'

export type Json = string | number | boolean | null | { [chave: string]: Json | undefined } | Json[]

export type Organizacao = {
  id: string
  nome: string
  rotulo: RotuloOrganizacao
  plano: Plano
  situacao: SituacaoOrganizacao
  teste_iniciado_em: string | null
  /** Último dia pago (`YYYY-MM-DD`); nulo = sem vencimento. Só o dev altera. */
  pago_ate: string | null
  /** Ajustes do dev que sobrescrevem os limites do plano. */
  limites: Json
  criado_em: string
}

/** Retorno de `admin_listar_organizacoes()`. */
export type OrganizacaoAdmin = Organizacao & {
  qtd_membros: number
  qtd_advogados: number
  oabs_ativas: number
  processos_ativos: number
  administrador_email: string | null
}

export type BuscaAgora = {
  id: number
  organizacao_id: string
  user_id: string | null
  criado_em: string
  /** Quando o robô aceitou o disparo (nulo = ainda não). */
  processada_em: string | null
}

export type Membro = {
  organizacao_id: string
  user_id: string
  papel: PapelMembro
  criado_em: string
}

/** Pertença de uma pessoa com os dados da organização (`membros` + `organizacoes`). */
export type MembroComOrganizacao = Membro & { organizacao: Organizacao }

/** Retorno de `membros_da_organizacao()`: a equipe com o e-mail de cada um. */
export type MembroDaEquipe = {
  user_id: string
  email: string
  papel: PapelMembro
  criado_em: string
}

export type Convite = {
  id: string
  organizacao_id: string
  email: string
  papel: PapelMembro
  token: string
  criado_por: string | null
  criado_em: string
  expira_em: string
  aceito_em: string | null
  /** Quando o robô mandou o e-mail (nulo = na fila; reenviar zera). */
  enviado_em: string | null
}

/** Retorno de `ver_convite()`, lido antes de a pessoa entrar. */
export type ResumoConvite = {
  organizacao: string
  papel: PapelMembro
  email: string
  situacao: 'pendente' | 'aceito' | 'expirado'
}

export type EscopoResumo = 'meus' | 'todos'

/**
 * Configuração pessoal: e-mail, janela de alerta e escopo do resumo. Dias para trás, prazo
 * padrão, recesso e token são da organização (`ConfiguracaoOrganizacao`).
 */
export type Configuracao = {
  user_id: string
  email_destino: string
  dias_alerta: number
  resumo_escopo: EscopoResumo | null
  updated_at: string
}

/** Configurações do robô que valem para a organização inteira; só o Administrador altera. */
export type ConfiguracaoOrganizacao = {
  organizacao_id: string
  dias_retroativos: number
  prazo_padrao_dias: number
  considerar_recesso: boolean
  webhook_token: string
  updated_at: string
}

export type Monitoramento = {
  id: number
  organizacao_id: string
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
  organizacao_id: string
  data: string
  descricao: string
}

export type Prazo = {
  id: string
  organizacao_id: string
  user_id: string
  responsavel_id: string | null
  /** Outros membros cujas OABs a mesma publicação intimou. */
  tambem_intimados: string[]
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
  organizacao_id: string | null
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
  dias_teste: number
  carencia_aviso_dias: number
  carencia_total_dias: number
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
      feriados_organizacao: {
        Row: Feriado
        Insert: Partial<Feriado> & Pick<Feriado, 'organizacao_id' | 'data'>
        Update: Partial<Omit<Feriado, 'organizacao_id'>>
        Relationships: []
      }
      configuracoes_organizacao: {
        Row: ConfiguracaoOrganizacao
        Insert: Partial<ConfiguracaoOrganizacao> & Pick<ConfiguracaoOrganizacao, 'organizacao_id'>
        Update: Partial<Omit<ConfiguracaoOrganizacao, 'organizacao_id'>>
        Relationships: []
      }
      convites: {
        Row: Convite
        Insert: Record<string, never>
        Update: Record<string, never>
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
      organizacoes: {
        Row: Organizacao
        Insert: Partial<Organizacao>
        Update: Partial<Omit<Organizacao, 'id'>>
        Relationships: []
      }
      membros: {
        Row: Membro
        Insert: Partial<Membro> & Pick<Membro, 'organizacao_id' | 'user_id'>
        Update: Partial<Pick<Membro, 'papel'>>
        Relationships: [
          {
            foreignKeyName: 'membros_organizacao_id_fkey'
            columns: ['organizacao_id']
            isOneToOne: false
            referencedRelation: 'organizacoes'
            referencedColumns: ['id']
          },
        ]
      }
      configuracao_sistema: {
        Row: ConfiguracaoSistema
        Insert: Partial<ConfiguracaoSistema>
        Update: Partial<
          Pick<ConfiguracaoSistema, 'n8n_webhook_url' | 'dias_teste' | 'carencia_aviso_dias' | 'carencia_total_dias'>
        >
        Relationships: []
      }
      buscas_agora: {
        Row: BuscaAgora
        Insert: Record<string, never>
        Update: Record<string, never>
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
      membro_de: { Args: { org: string }; Returns: boolean }
      organizacao_de: { Args: { uid: string }; Returns: string | null }
      admin_listar_contas: { Args: Record<string, never>; Returns: ContaAdmin[] }
      admin_metricas: { Args: Record<string, never>; Returns: MetricasAdmin }
      admin_listar_organizacoes: { Args: Record<string, never>; Returns: OrganizacaoAdmin[] }
      registrar_busca_agora: { Args: { org: string }; Returns: number }
      cancelar_busca_agora: { Args: { busca: number }; Returns: undefined }
      tem_papel: { Args: { org: string; papeis: PapelMembro[] }; Returns: boolean }
      membros_da_organizacao: { Args: { org: string }; Returns: MembroDaEquipe[] }
      convidar: {
        Args: { org: string; email_convidado: string; papel_convidado: PapelMembro }
        Returns: Convite
      }
      reenviar_convite: { Args: { convite: string }; Returns: Convite }
      cancelar_convite: { Args: { convite: string }; Returns: undefined }
      ver_convite: { Args: { codigo: string }; Returns: ResumoConvite[] }
      aceitar_convite: { Args: { codigo: string }; Returns: string }
      alterar_papel: { Args: { org: string; membro: string; novo_papel: PapelMembro }; Returns: undefined }
      remover_membro: { Args: { org: string; membro: string }; Returns: undefined }
      admin_trocar_token: { Args: { conta: string; token: string }; Returns: undefined }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
