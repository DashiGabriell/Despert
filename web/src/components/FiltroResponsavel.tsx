import type { FiltroDeResponsavel } from '../data/responsaveis'
import { TODOS_RESPONSAVEIS } from '../domain/filtros'
import { campo } from './ui'

export default function FiltroResponsavel({ filtro, eu }: { filtro: FiltroDeResponsavel; eu: string }) {
  if (!filtro.equipe) return null
  return (
    <select
      aria-label="Filtrar por responsável"
      className={`${campo} max-w-52`}
      value={filtro.responsavel}
      onChange={(e) => filtro.setResponsavel(e.target.value)}
    >
      <option value={eu}>Meus prazos</option>
      <option value={TODOS_RESPONSAVEIS}>Todos os responsáveis</option>
      {filtro.equipe
        .filter((m) => m.user_id !== eu)
        .map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {filtro.nomes?.get(m.user_id)}
          </option>
        ))}
    </select>
  )
}
