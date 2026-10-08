import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as EventoPonteiro,
  type ReactNode,
} from 'react'
import { NavLink } from 'react-router-dom'
import { ICONE_MAIS } from '../lib/navegacao'

export function IconeApp({ d, className = 'size-4.5 shrink-0' }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={d} />
    </svg>
  )
}

export interface AbaApp {
  to: string
  rotulo: string
  d: string
  /** número no selinho vermelho sobre o ícone (ex.: prazos críticos) */
  contador?: number
  /** rótulo completo para leitores de tela, quando o visível é abreviado */
  rotuloCompleto?: string
}

export interface AcaoApp {
  rotulo: string
  d: string
  onClick: () => void
  desabilitada?: boolean
}

/** Barra de abas fixa no rodapé, só no celular. A ação principal fica no centro, em destaque. */
export function BarraAbas({
  abas,
  acao,
  maisAberta,
  maisAtiva,
  onMais,
  rotulo,
}: {
  abas: readonly AbaApp[]
  acao?: AcaoApp
  maisAberta: boolean
  /** a tela atual é um dos itens que moram na folha "Mais" */
  maisAtiva: boolean
  onMais: () => void
  rotulo: string
}) {
  const meio = Math.ceil(abas.length / 2)
  const aba = (item: AbaApp) => (
    <NavLink key={item.to} to={item.to} className="app-aba" aria-label={item.rotuloCompleto}>
      <span className="app-aba-icone">
        <IconeApp d={item.d} />
      </span>
      <span className="app-aba-rotulo">{item.rotulo}</span>
      {item.contador ? (
        <span className="app-aba-contador" aria-label={`${item.contador} críticos`}>
          {item.contador > 99 ? '99+' : item.contador}
        </span>
      ) : null}
    </NavLink>
  )

  return (
    <nav className="app-abas md:hidden" aria-label={rotulo}>
      {abas.slice(0, meio).map(aba)}
      {acao && (
        <button
          type="button"
          className="app-aba app-aba-acao"
          onClick={acao.onClick}
          disabled={acao.desabilitada}
        >
          <span className="app-aba-icone">
            <IconeApp d={acao.d} />
          </span>
          <span className="app-aba-rotulo">{acao.rotulo}</span>
        </button>
      )}
      {abas.slice(meio).map(aba)}
      <button
        type="button"
        className="app-aba"
        aria-haspopup="dialog"
        aria-expanded={maisAberta}
        data-ativa={maisAtiva}
        onClick={onMais}
      >
        <span className="app-aba-icone">
          <IconeApp d={ICONE_MAIS} />
        </span>
        <span className="app-aba-rotulo">Mais</span>
      </button>
    </nav>
  )
}

/**
 * Folha que sobe do rodapé (<dialog> nativo): foco preso, Esc fecha, toque fora fecha
 * e arrastar a alça para baixo fecha. O conteúdo só existe enquanto ela está aberta.
 */
export function FolhaApp({
  aberta,
  onFechar,
  titulo,
  subtitulo,
  icone,
  children,
}: {
  aberta: boolean
  onFechar: () => void
  titulo: ReactNode
  subtitulo?: ReactNode
  icone?: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const inicioY = useRef<number | null>(null)
  const [arrasto, setArrasto] = useState(0)
  const idTitulo = useId()

  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    if (aberta && !dlg.open) {
      if (typeof dlg.showModal === 'function') dlg.showModal()
      else dlg.setAttribute('open', '')
    } else if (!aberta && dlg.open) {
      dlg.close?.()
      dlg.removeAttribute('open')
    }
  }, [aberta])

  function comecar(e: EventoPonteiro<HTMLDivElement>) {
    inicioY.current = e.clientY
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function mover(e: EventoPonteiro<HTMLDivElement>) {
    if (inicioY.current === null) return
    setArrasto(Math.max(0, e.clientY - inicioY.current))
  }

  function soltar() {
    if (inicioY.current === null) return
    inicioY.current = null
    if (arrasto > 80) onFechar()
    setArrasto(0)
  }

  return (
    <dialog
      ref={ref}
      className="app-folha"
      aria-labelledby={idTitulo}
      onClose={onFechar}
      onCancel={(e) => {
        e.preventDefault()
        onFechar()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar()
      }}
      style={arrasto ? { transform: `translateY(${arrasto}px)`, transition: 'none' } : undefined}
    >
      {aberta && (
        <div className="app-folha-corpo">
          <div
            className="app-folha-topo"
            onPointerDown={comecar}
            onPointerMove={mover}
            onPointerUp={soltar}
            onPointerCancel={soltar}
          >
            <span className="app-folha-alca" aria-hidden />
            <div className="flex items-center gap-3">
              {icone}
              <div className="min-w-0">
                <strong id={idTitulo} className="block truncate text-lg text-ink">
                  {titulo}
                </strong>
                {subtitulo && <span className="block truncate text-sm text-muted">{subtitulo}</span>}
              </div>
            </div>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}

const SETA = 'M9 18l6-6-6-6'

/** Linha de navegação dentro da folha (52px de altura, como lista de ajustes). */
export function LinkFolha({ to, rotulo, d, onClick }: { to: string; rotulo: string; d: string; onClick: () => void }) {
  return (
    <NavLink to={to} className="app-folha-link" onClick={onClick}>
      <span className="app-folha-link-icone">
        <IconeApp d={d} />
      </span>
      {rotulo}
      <IconeApp d={SETA} className="app-folha-seta" />
    </NavLink>
  )
}

export function BotaoFolha({
  rotulo,
  d,
  onClick,
  perigo = false,
}: {
  rotulo: string
  d: string
  onClick: () => void
  perigo?: boolean
}) {
  return (
    <button
      type="button"
      className={`app-folha-link ${perigo ? 'text-danger' : ''}`}
      onClick={onClick}
    >
      <span className={`app-folha-link-icone ${perigo ? 'bg-danger-soft text-danger' : ''}`}>
        <IconeApp d={d} />
      </span>
      {rotulo}
    </button>
  )
}
