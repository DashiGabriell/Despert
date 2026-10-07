import type { FiltroRapido } from '../domain/filtros'
import type { Indicadores as Contagem } from '../domain/indicadores'

const ITENS: { chave: Exclude<FiltroRapido, null>; rotulo: string; cor: string }[] = [
  { chave: 'vencido', rotulo: 'Vencidos', cor: 'border-l-danger [&_strong]:text-danger' },
  { chave: 'hoje', rotulo: 'Vencem hoje', cor: 'border-l-alert [&_strong]:text-alert' },
  { chave: 'semana', rotulo: 'Próximos 7 dias', cor: 'border-l-gold [&_strong]:text-gold' },
  { chave: 'conferir', rotulo: 'Para conferir', cor: 'border-l-info [&_strong]:text-info' },
  { chave: 'abertos', rotulo: 'Em aberto', cor: 'border-l-navy [&_strong]:text-navy' },
]

interface Props {
  contagem: Contagem
  ativo: FiltroRapido
  onSelecionar: (filtro: FiltroRapido) => void
}

export default function Indicadores({ contagem, ativo, onSelecionar }: Props) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-5">
      {ITENS.map((item) => {
        const selecionado = ativo === item.chave
        return (
          <button
            key={item.chave}
            type="button"
            aria-pressed={selecionado}
            onClick={() => onSelecionar(selecionado ? null : item.chave)}
            className={`cursor-pointer rounded-xl border border-l-4 border-line bg-card p-4 text-left shadow-sm transition-transform hover:-translate-y-px ${item.cor} ${selecionado ? 'outline-2 outline-navy' : ''}`}
          >
            <strong className="block text-[28px] leading-tight font-bold">{contagem[item.chave]}</strong>
            <span className="mt-1 block text-sm text-muted">{item.rotulo}</span>
          </button>
        )
      })}
    </div>
  )
}
