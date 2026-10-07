import type { FiltroRapido } from '../domain/filtros'
import type { Indicadores as Contagem } from '../domain/indicadores'

const ITENS: { chave: Exclude<FiltroRapido, null>; rotulo: string; cor: string; marca: string }[] = [
  { chave: 'vencido', rotulo: 'Vencidos', cor: 'text-danger', marca: 'bg-danger' },
  { chave: 'hoje', rotulo: 'Vencem hoje', cor: 'text-primary', marca: 'bg-primary' },
  { chave: 'semana', rotulo: 'Próximos 7 dias', cor: 'text-alert', marca: 'bg-gold' },
  { chave: 'conferir', rotulo: 'Para conferir', cor: 'text-navy', marca: 'bg-navy' },
  { chave: 'abertos', rotulo: 'Em aberto', cor: 'text-ok', marca: 'bg-ok' },
]

interface Props {
  contagem: Contagem
  ativo: FiltroRapido
  onSelecionar: (filtro: FiltroRapido) => void
}

export default function Indicadores({ contagem, ativo, onSelecionar }: Props) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-5">
      {ITENS.map((item) => {
        const selecionado = ativo === item.chave
        return (
          <button
            key={item.chave}
            type="button"
            aria-pressed={selecionado}
            onClick={() => onSelecionar(selecionado ? null : item.chave)}
            className="ds-metric"
          >
            <span className="ds-metric-label flex items-center gap-1.5">
              <span aria-hidden className={`size-2 shrink-0 rounded-full ${item.marca}`} />
              {item.rotulo}
            </span>
            <strong className={`ds-metric-value font-display ${item.cor}`}>{contagem[item.chave]}</strong>
          </button>
        )
      })}
    </div>
  )
}
