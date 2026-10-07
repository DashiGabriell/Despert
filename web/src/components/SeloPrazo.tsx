import type { DataISO } from '../domain/dias'
import { seloDoPrazo } from '../domain/selo'
import type { PrazoUrgencia } from '../domain/urgencia'
import { CORES_URGENCIA } from './ui'

export default function SeloPrazo({ prazo, hoje }: { prazo: PrazoUrgencia; hoje: DataISO }) {
  const selo = seloDoPrazo(prazo, hoje)
  return (
    <span
      data-urgencia={selo.urgencia}
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${CORES_URGENCIA[selo.urgencia]}`}
    >
      {selo.texto}
    </span>
  )
}
