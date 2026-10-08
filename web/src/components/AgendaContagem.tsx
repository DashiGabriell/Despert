import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { diaDaSemana, formatarData, gradeDoMes, mesDe, nomeDoMes } from '../domain/datas'
import {
  contarPrazo,
  EXEMPLO_PUBLICACAO,
  marcaDoDia,
  narrarContagem,
  PRAZOS_DE_EXEMPLO,
  type Marca,
} from '../domain/demonstracao'
import { nomeFeriadoNacional, type DataISO } from '../domain/dias'

const MES = mesDe(EXEMPLO_PUBLICACAO)
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const POR_EXTENSO: Record<number, string> = { 5: 'cinco', 10: 'dez', 15: 'quinze' }
const RITMO_MS = 110
const PAUSA_INICIAL_MS = 600

function semMovimento(): boolean {
  return typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function Celula({ dia, marca, dias }: { dia: DataISO; marca: Marca; dias: number }) {
  const feriado = nomeFeriadoNacional(dia)
  const fimDeSemana = [0, 6].includes(diaDaSemana(dia))
  const pulado = marca.tipo === 'pulado'
  const fundo = pulado ? 'lp-hachura bg-[var(--lp-papel)]' : fimDeSemana || feriado ? 'bg-secondary' : 'bg-[var(--lp-papel)]'

  return (
    <div aria-hidden className={`relative flex min-h-14 flex-col p-1.5 sm:min-h-20 lg:min-h-[100px] lg:p-2.5 ${fundo}`}>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`font-display text-base leading-none font-semibold sm:text-xl lg:text-2xl ${
            pulado || fimDeSemana ? 'text-muted' : 'text-navy'
          } ${feriado ? 'underline decoration-gold decoration-2 underline-offset-4' : ''}`}
        >
          {Number(dia.slice(8))}
        </span>
        {feriado && (
          <span
            title={feriado}
            className="hidden truncate rounded bg-[var(--lp-papel)] px-1 text-[11px] leading-tight font-semibold text-gold-ink sm:block"
          >
            {feriado}
          </span>
        )}
      </div>

      {marca.tipo === 'publicacao' && (
        <div className="lp-marca mt-auto rounded-md bg-navy px-1.5 py-1 text-white lg:p-2.5">
          <span className="block text-[10px] font-semibold tracking-wide uppercase sm:text-[11px]">DJEN</span>
          <span className="hidden text-xs leading-snug text-white/85 lg:block">
            Intimação para manifestação no prazo de {dias} ({POR_EXTENSO[dias]}) dias.
          </span>
        </div>
      )}

      {marca.tipo === 'pulado' && (
        <span className="lp-marca mt-auto hidden text-[11px] font-semibold text-muted sm:block">não conta</span>
      )}

      {marca.tipo === 'util' && !marca.vencimento && (
        <span className="lp-marca mt-auto self-start rounded-full bg-primary-soft px-1.5 text-[11px] font-semibold text-primary sm:px-2 sm:text-xs">
          <span className="hidden sm:inline">dia </span>
          {marca.numero}
        </span>
      )}

      {marca.tipo === 'util' && marca.vencimento && (
        <div className="mt-auto flex flex-col items-center gap-0.5">
          <img src="/logo-despert-256.png" alt="" className="lp-selo size-8 sm:size-12 lg:size-16" />
          <span className="lp-marca text-[10px] font-bold tracking-wide text-primary uppercase sm:text-xs">
            Vence
          </span>
        </div>
      )}
    </div>
  )
}

/** Agenda de exemplo onde a contagem de dias úteis anda até o vencimento. */
export default function AgendaContagem({ abertura }: { abertura: ReactNode }) {
  const [dias, setDias] = useState<number>(10)
  const contagem = useMemo(() => contarPrazo(EXEMPLO_PUBLICACAO, dias), [dias])
  const [andados, setAndados] = useState(() => (semMovimento() ? Infinity : 0))

  useEffect(() => {
    if (andados >= contagem.passos.length) return
    const id = window.setTimeout(() => setAndados((a) => a + 1), andados === 0 ? PAUSA_INICIAL_MS : RITMO_MS)
    return () => window.clearTimeout(id)
  }, [andados, contagem.passos.length])

  function recontar(novo: number) {
    setDias(novo)
    setAndados(semMovimento() ? Infinity : 0)
  }

  const parado = semMovimento()
  const diasDoMes = gradeDoMes(MES).filter((d) => mesDe(d) === MES)
  const vazios = diaDaSemana(diasDoMes[0])
  const feriadosNaContagem = contagem.passos.flatMap((p) => {
    const nome = nomeFeriadoNacional(p.data)
    return nome ? [`${formatarData(p.data).slice(0, 5)} · ${nome}`] : []
  })

  return (
    <section aria-label="Agenda de exemplo" className="overflow-hidden rounded-2xl border border-line bg-card shadow-[0_24px_60px_-28px_rgba(20,33,61,0.35)]">
      <div className="grid grid-cols-7 gap-px bg-line">
        <div className="order-first col-span-7 bg-[var(--lp-papel)] p-5 sm:p-8 lg:order-none lg:col-span-4 lg:row-start-3">
          {abertura}
        </div>

        <div className="col-span-7 flex flex-wrap items-center gap-x-4 gap-y-3 bg-card px-4 py-3.5 sm:px-5">
          <p className="mr-auto flex items-baseline gap-2.5">
            <span className="font-display text-2xl font-bold text-navy">{nomeDoMes(MES)}</span>
            <span className="ds-badge ds-badge-coin">Exemplo</span>
          </p>
          <div role="group" aria-label="Prazo do exemplo" className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-sm text-muted">Prazo de</span>
            {PRAZOS_DE_EXEMPLO.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={dias === n}
                onClick={() => recontar(n)}
                className={`ds-btn ds-btn-sm ${dias === n ? 'ds-btn-primary' : 'ds-btn-secondary'}`}
              >
                {n}
              </button>
            ))}
            <span className="ml-1 text-sm text-muted">dias úteis</span>
          </div>
          {!parado && (
            <button type="button" className="ds-btn ds-btn-ghost ds-btn-sm" onClick={() => recontar(dias)}>
              Contar de novo
            </button>
          )}
        </div>

        {DIAS_SEMANA.map((d) => (
          <div
            key={d}
            aria-hidden
            className="bg-secondary py-1.5 text-center text-[11px] font-semibold tracking-wider text-muted uppercase"
          >
            {d}
          </div>
        ))}

        {Array.from({ length: vazios }, (_, i) => (
          <div key={`vazio-${i}`} aria-hidden className="bg-[var(--lp-papel)] lg:hidden" />
        ))}

        {diasDoMes.map((dia) => (
          <Celula key={dia} dia={dia} dias={dias} marca={marcaDoDia(contagem, dia, andados)} />
        ))}
      </div>

      {feriadosNaContagem.length > 0 && (
        <p aria-hidden className="border-t border-line bg-card px-4 pt-3 text-sm font-semibold text-gold-ink sm:hidden">
          {feriadosNaContagem.join(', ')}: feriado, não conta
        </p>
      )}
      <p aria-live="polite" className="bg-card px-4 py-3 text-sm text-ink sm:border-t sm:border-line sm:px-5">
        {narrarContagem(contagem, dias)}
      </p>
    </section>
  )
}
