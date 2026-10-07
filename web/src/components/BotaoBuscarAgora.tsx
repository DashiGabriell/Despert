import { formatarRestante, type EstadoBusca } from '../domain/busca'
import { botaoDourado } from './ui'

interface Props {
  estado: EstadoBusca
  restanteMs: number
  onBuscar: () => void
  /** Intervalo mínimo entre buscas da organização, para a dica do botão. */
  intervaloMin?: number
  /** Buscas que a organização ainda pode disparar hoje. */
  restantesHoje?: number
}

function dica(estado: EstadoBusca, intervaloMin: number, restantesHoje: number | undefined): string | undefined {
  switch (estado) {
    case 'bloqueado':
      return `Para não sobrecarregar o Diário, a busca manual fica disponível a cada ${intervaloMin} minutos.`
    case 'esgotado':
      return 'As buscas manuais de hoje já foram usadas pela organização. Liberam de novo à meia-noite; a busca automática continua normalmente.'
    case 'indisponivel':
      return 'Organização em modo somente leitura: a busca manual fica desligada até a reativação.'
    case 'ocioso':
      return restantesHoje === undefined ? undefined : `${restantesHoje} busca(s) manual(is) disponível(is) hoje.`
    default:
      return undefined
  }
}

export default function BotaoBuscarAgora({ estado, restanteMs, onBuscar, intervaloMin = 10, restantesHoje }: Props) {
  return (
    <button
      type="button"
      className={botaoDourado}
      disabled={estado !== 'ocioso'}
      onClick={onBuscar}
      title={dica(estado, intervaloMin, restantesHoje)}
    >
      {estado === 'buscando' ? (
        <>
          <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
          Buscando…
        </>
      ) : estado === 'bloqueado' ? (
        <>Nova busca em {formatarRestante(restanteMs)}</>
      ) : estado === 'esgotado' ? (
        <>Buscas de hoje usadas</>
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
