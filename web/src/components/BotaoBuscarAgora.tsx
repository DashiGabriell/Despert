import { formatarRestante, type EstadoBusca } from '../domain/busca'
import { botaoDourado } from './ui'

interface Props {
  estado: EstadoBusca
  restanteMs: number
  onBuscar: () => void
}

export default function BotaoBuscarAgora({ estado, restanteMs, onBuscar }: Props) {
  return (
    <button
      type="button"
      className={botaoDourado}
      disabled={estado !== 'ocioso'}
      onClick={onBuscar}
      title={
        estado === 'bloqueado'
          ? 'Para não sobrecarregar o Diário, a busca manual fica disponível a cada 10 minutos.'
          : undefined
      }
    >
      {estado === 'buscando' ? (
        <>
          <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          Buscando…
        </>
      ) : estado === 'bloqueado' ? (
        <>Nova busca em {formatarRestante(restanteMs)}</>
      ) : (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4" aria-hidden>
            <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8M21 3v5h-5" />
          </svg>
          Buscar agora
        </>
      )}
    </button>
  )
}
