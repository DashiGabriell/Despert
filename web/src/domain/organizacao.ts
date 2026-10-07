import type { MembroComOrganizacao } from '../lib/database.types'

/** Onde fica (no localStorage) a organização escolhida por cada pessoa no seletor. */
export function chaveOrganizacaoPreferida(userId: string): string {
  return `despert:organizacao:${userId}`
}

/**
 * Organização cujos dados a tela mostra: a preferida, se a pessoa ainda pertence a ela;
 * senão, a mais antiga das suas organizações.
 */
export function organizacaoAtiva(
  pertencas: readonly MembroComOrganizacao[],
  preferida?: string | null,
): MembroComOrganizacao | null {
  const escolhida = preferida ? pertencas.find((p) => p.organizacao_id === preferida) : undefined
  if (escolhida) return escolhida
  return [...pertencas].sort((a, b) => a.criado_em.localeCompare(b.criado_em))[0] ?? null
}
