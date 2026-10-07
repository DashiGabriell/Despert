import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { botao } from './ui'

interface Props {
  temMonitoramento: boolean
  temWebhook: boolean
  onPrazoManual: () => void
}

function Passo({ numero, feito, children }: { numero: number; feito: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${feito ? 'bg-ok text-white' : 'bg-primary/10 text-primary'}`}
        aria-label={feito ? 'Concluído' : `Passo ${numero}`}
      >
        {feito ? '✓' : numero}
      </span>
      <span className={feito ? 'text-muted line-through' : ''}>{children}</span>
    </li>
  )
}

/** Primeira utilização: orienta o próximo passo sem inventar dados de exemplo. */
export default function GuiaInicio({ temMonitoramento, temWebhook, onPrazoManual }: Props) {
  return (
    <div className="ds-empty mx-auto max-w-xl text-left">
      <h2 className="text-center text-2xl font-bold text-navy">Nenhuma publicação capturada ainda</h2>
      <p className="mt-1 mb-5 text-center text-sm text-muted">
        Em três passos o robô passa a ler o Diário de Justiça Eletrônico Nacional por você.
      </p>
      <ol className="mx-auto max-w-md space-y-3 text-sm text-ink">
        <Passo numero={1} feito={temMonitoramento}>
          Cadastre sua OAB (ou um processo) em{' '}
          <Link className="font-semibold text-primary underline underline-offset-2" to="/monitoramento">
            Monitoramento
          </Link>
          .
        </Passo>
        <Passo numero={2} feito={temWebhook}>
          Informe a URL do webhook do n8n em{' '}
          <Link className="font-semibold text-primary underline underline-offset-2" to="/configuracoes">
            Configurações
          </Link>
          .
        </Passo>
        <Passo numero={3} feito={false}>
          Clique em <strong>Buscar agora</strong>. Depois disso o robô roda sozinho todo dia útil às 07:00.
        </Passo>
      </ol>
      <div className="mt-6 text-center">
        <button type="button" className={botao} onClick={onPrazoManual}>
          Ou crie um prazo manual
        </button>
      </div>
    </div>
  )
}
