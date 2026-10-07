import { describe, expect, it } from 'vitest'
import type { PapelMembro } from '../lib/database.types'
import { PAPEIS, pode, type Acao } from './permissoes'

// Tabela de permissões da fase 3 (#18), linha a linha. O banco aplica a mesma tabela no RLS
// (supabase/tests/permissoes_papeis.sql).
const TABELA: [Acao, PapelMembro[]][] = [
  ['ver_prazos', ['administrador', 'advogado', 'assistente', 'leitura']],
  ['editar_prazo', ['administrador', 'advogado', 'assistente']],
  ['cumprir_prazo', ['administrador', 'advogado', 'assistente']],
  ['excluir_prazo', ['administrador', 'advogado']],
  ['trocar_responsavel', ['administrador', 'advogado', 'assistente']],
  ['gerenciar_monitoramentos', ['administrador', 'advogado']],
  ['configurar_organizacao', ['administrador']],
  ['gerenciar_equipe', ['administrador']],
  ['ver_auditoria', ['administrador']],
  ['exportar_relatorios', ['administrador', 'advogado', 'leitura']],
  ['buscar_agora', ['administrador', 'advogado', 'assistente']],
]

describe('permissões por papel', () => {
  it.each(TABELA)('%s: só %j', (acao, permitidos) => {
    for (const papel of PAPEIS) {
      expect(pode(papel, acao), `${papel} → ${acao}`).toBe(permitidos.includes(papel))
    }
  })
})
