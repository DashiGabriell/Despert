import type { DataISO } from '../domain/dias'
import { seloDoPrazo } from '../domain/selo'
import type { PrazoUrgencia } from '../domain/urgencia'
import { CORES_URGENCIA } from './ui'

export default function SeloPrazo({ prazo, hoje }: { prazo: PrazoUrgencia; hoje: DataISO }) {
  const selo = seloDoPrazo(prazo, hoje)
  return (
    <span
      data-urgencia={selo.urgencia}
      className={`ds-badge ${CORES_URGENCIA[selo.urgencia]}`}
    >
      {selo.texto}
    </span>
  )
}
