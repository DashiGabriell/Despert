import { useMemo, useState } from 'react'
import { nomeDoMembro } from '../domain/equipe'
import { TODOS_RESPONSAVEIS } from '../domain/filtros'
import type { MembroDaEquipe } from '../lib/database.types'
import { useMembros } from './queries'

export interface FiltroDeResponsavel {
  /** Equipe com mais de uma pessoa; `null` no Solo (nada de responsável aparece). */
  equipe: readonly MembroDaEquipe[] | null
  nomes: ReadonlyMap<string, string> | undefined
  responsavel: string
  setResponsavel: (valor: string) => void
}

/** Filtro de responsável das telas de prazos: começa em "Meus prazos" (#18). */
export function useFiltroResponsavel(orgId: string, eu: string): FiltroDeResponsavel {
  const membros = useMembros(orgId)
  const equipe = membros.data && membros.data.length > 1 ? membros.data : null
  const nomes = useMemo(
    () => (equipe ? new Map(equipe.map((m) => [m.user_id, nomeDoMembro(m, eu)])) : undefined),
    [equipe, eu],
  )
  const [responsavel, setResponsavel] = useState(eu)
  return { equipe, nomes, responsavel: equipe ? responsavel : TODOS_RESPONSAVEIS, setResponsavel }
}
