import { useMemo } from 'react'
import {
  carenciaDe,
  diasAteMudar,
  etapaDaOrganizacao,
  limitesEfetivos,
  permiteEscrita,
  type Carencia,
  type Etapa,
  type Limites,
} from '../domain/planos'
import { usePertenca } from '../lib/organizacao-context'
import { useConfiguracaoSistema } from './queries'
import { useHoje } from './relogio'

export interface EstadoDoPlano {
  limites: Limites
  etapa: Etapa
  carencia: Carencia
  /** Dias até a próxima etapa (fim do teste, somente leitura, suspensão), ou `null`. */
  diasAteMudar: number | null
  /** Os membros podem alterar dados (falso em somente leitura e suspensa). */
  escrita: boolean
}

/** Limites e etapa da organização ativa. O banco aplica as mesmas regras. */
export function usePlano(): EstadoDoPlano {
  const { organizacao } = usePertenca()
  const sistema = useConfiguracaoSistema()
  const hoje = useHoje()
  return useMemo(() => {
    const carencia = carenciaDe(sistema.data)
    const etapa = etapaDaOrganizacao(organizacao, hoje, carencia)
    return {
      limites: limitesEfetivos(organizacao.plano, organizacao.limites),
      etapa,
      carencia,
      diasAteMudar: diasAteMudar(organizacao, hoje, carencia),
      escrita: permiteEscrita(etapa),
    }
  }, [organizacao, sistema.data, hoje])
}
