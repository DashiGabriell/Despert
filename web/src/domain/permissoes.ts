import type { PapelMembro } from '../lib/database.types'

export const PAPEIS: readonly PapelMembro[] = ['administrador', 'advogado', 'assistente', 'leitura']

export type Acao =
  | 'ver_prazos'
  | 'editar_prazo'
  | 'cumprir_prazo'
  | 'excluir_prazo'
  | 'trocar_responsavel'
  | 'gerenciar_monitoramentos'
  | 'configurar_organizacao'
  | 'gerenciar_equipe'
  | 'ver_auditoria'
  | 'exportar_relatorios'
  | 'buscar_agora'

/** Espelho do RLS em supabase/schema.sql: mudar um exige mudar o outro. */
const PERMISSOES: Record<Acao, readonly PapelMembro[]> = {
  ver_prazos: PAPEIS,
  editar_prazo: ['administrador', 'advogado', 'assistente'],
  cumprir_prazo: ['administrador', 'advogado', 'assistente'],
  excluir_prazo: ['administrador', 'advogado'],
  trocar_responsavel: ['administrador', 'advogado', 'assistente'],
  gerenciar_monitoramentos: ['administrador', 'advogado'],
  configurar_organizacao: ['administrador'],
  gerenciar_equipe: ['administrador'],
  ver_auditoria: ['administrador'],
  exportar_relatorios: ['administrador', 'advogado', 'leitura'],
  buscar_agora: ['administrador', 'advogado', 'assistente'],
}

export function pode(papel: PapelMembro, acao: Acao): boolean {
  return PERMISSOES[acao].includes(papel)
}
