import {
  diaDaSemana,
  formatarData,
  gradeDoMes,
  mesDe,
  nomeDoMes,
  somarMeses,
  type MesISO,
} from '../domain/datas'
import { nomeFeriadoNacional, type DataISO } from '../domain/dias'
import { classificarUrgencia } from '../domain/urgencia'
import type { Feriado, Prazo } from '../lib/database.types'
import { botaoPequeno, CORES_URGENCIA } from './ui'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface Props {
  mes: MesISO
  hoje: DataISO
  prazos: readonly Prazo[]
  feriados: readonly Pick<Feriado, 'data' | 'descricao'>[]
  onMudarMes: (mes: MesISO) => void
  onAbrirPrazo: (prazo: Prazo) => void
  onCriarNoDia: (data: DataISO) => void
}

export default function CalendarioMes({
  mes,
  hoje,
  prazos,
  feriados,
  onMudarMes,
  onAbrirPrazo,
  onCriarNoDia,
}: Props) {
  const porDia = new Map<string, Prazo[]>()
  for (const prazo of prazos) {
    if (!prazo.vencimento || prazo.status === 'arquivado') continue
    const dia = prazo.vencimento.slice(0, 10)
    porDia.set(dia, [...(porDia.get(dia) ?? []), prazo])
  }
  const locais = new Map(feriados.map((f) => [f.data, f.descricao]))

  return (
    <section className="ds-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line p-3.5">
        <button
          type="button"
          className={botaoPequeno}
          aria-label="Mês anterior"
          onClick={() => onMudarMes(somarMeses(mes, -1))}
        >
          ‹
        </button>
        <button
          type="button"
          className={botaoPequeno}
          aria-label="Próximo mês"
          onClick={() => onMudarMes(somarMeses(mes, 1))}
        >
          ›
        </button>
        <h2 className="mr-auto ml-1.5 text-2xl font-bold text-navy">{nomeDoMes(mes)}</h2>
        <button type="button" className={botaoPequeno} onClick={() => onMudarMes(mesDe(hoje))}>
          Hoje
        </button>
      </div>

      <div className="grid grid-cols-7">
        {DIAS_SEMANA.map((d) => (
          <div
            key={d}
            className="border-b border-line bg-secondary/70 p-2 text-center text-[11px] font-semibold tracking-wider text-muted uppercase"
          >
            {d}
          </div>
        ))}
        {gradeDoMes(mes).map((dia, indice) => {
          const doMes = mesDe(dia) === mes
          const fimDeSemana = [0, 6].includes(diaDaSemana(dia))
          const feriado = locais.get(dia) ?? nomeFeriadoNacional(dia)
          const itens = porDia.get(dia) ?? []
          const ehHoje = dia === hoje
          const classes = [
            'min-h-[70px] border-b border-line p-1.5 text-left md:min-h-[108px]',
            indice % 7 === 6 ? '' : 'border-r',
            feriado ? 'bg-gold/10' : !doMes ? 'bg-secondary/60' : fimDeSemana ? 'bg-secondary/30' : '',
          ].join(' ')
          const cabecalho = (
            <div className="flex items-start gap-1">
              <span
                className={`inline-grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${ehHoje ? 'ds-marca size-6 rounded-full text-xs' : doMes ? '' : 'text-muted/50'}`}
              >
                {Number(dia.slice(8))}
              </span>
              {feriado && (
                <span className="truncate pt-1 text-[10px] font-semibold text-alert" title={feriado}>
                  {feriado}
                </span>
              )}
            </div>
          )

          if (itens.length === 0) {
            return (
              <button
                key={dia}
                type="button"
                data-dia={dia}
                aria-label={`Criar prazo em ${formatarData(dia)}`}
                className={`${classes} cursor-pointer transition-colors hover:bg-primary/5`}
                onClick={() => onCriarNoDia(dia)}
              >
                {cabecalho}
              </button>
            )
          }
          return (
            <div key={dia} data-dia={dia} className={classes}>
              {cabecalho}
              {itens.map((prazo) => {
                const urgencia = classificarUrgencia(prazo, hoje)
                return (
                  <button
                    key={prazo.id}
                    type="button"
                    data-urgencia={urgencia}
                    title={`${prazo.processo ?? ''} — ${prazo.tipo ?? ''}`}
                    onClick={() => onAbrirPrazo(prazo)}
                    className={`mt-1 block w-full cursor-pointer truncate rounded-lg px-1.5 py-0.5 text-left text-[10px] font-semibold transition-transform hover:-translate-y-px md:text-[11px] ${CORES_URGENCIA[urgencia]} ${urgencia === 'fechado' ? 'line-through' : ''}`}
                  >
                    {prazo.processo || prazo.tipo || 'Prazo'}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </section>
  )
}
