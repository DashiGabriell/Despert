import { useState } from 'react'
import GuiaInicio from '../components/GuiaInicio'
import Indicadores from '../components/Indicadores'
import TabelaPrazos from '../components/TabelaPrazos'
import { alertaErro, botaoPequeno, campo } from '../components/ui'
import { useAtualizarPrazo, useConfiguracao, useMonitoramentos, usePrazos } from '../data/queries'
import { filtrarPrazos, type FiltroRapido, type FiltroStatus } from '../domain/filtros'
import { contarIndicadores } from '../domain/indicadores'
import { useAuth, useUserId } from '../lib/auth-context'
import type { Prazo } from '../lib/database.types'
import { useLayout } from '../lib/layout-context'
import { mensagemDeErro, useToast } from '../lib/toast-context'

const OPCOES_STATUS: { valor: FiltroStatus; rotulo: string }[] = [
  { valor: 'abertos', rotulo: 'Em aberto' },
  { valor: 'pendente', rotulo: 'Pendentes' },
  { valor: 'conferir', rotulo: 'Para conferir' },
  { valor: 'cumprido', rotulo: 'Cumpridos' },
  { valor: 'arquivado', rotulo: 'Arquivados' },
  { valor: 'todos', rotulo: 'Todos' },
]

export default function Prazos() {
  const userId = useUserId()
  const { sessao } = useAuth()
  const { hoje, abrirPrazo, novoPrazo } = useLayout()
  const avisar = useToast()
  const prazos = usePrazos(userId)
  const monitoramentos = useMonitoramentos(userId)
  const config = useConfiguracao(userId, sessao?.user.email)
  const atualizar = useAtualizarPrazo(userId)

  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState<FiltroStatus>('abertos')
  const [rapido, setRapido] = useState<FiltroRapido>(null)

  if (prazos.isPending) {
    return <p className="text-sm text-muted">Carregando prazos…</p>
  }
  if (prazos.isError) {
    return (
      <div className={alertaErro}>
        Não foi possível carregar os prazos: {mensagemDeErro(prazos.error)}{' '}
        <button type="button" className="ml-2 underline" onClick={() => void prazos.refetch()}>
          Tentar de novo
        </button>
      </div>
    )
  }

  const todos = prazos.data
  const lista = filtrarPrazos(todos, { busca, status, rapido, hoje })
  const filtrando = rapido !== null || busca.trim() !== '' || status !== 'abertos'

  function cumprir(prazo: Prazo) {
    atualizar.mutate(
      { id: prazo.id, dados: { status: 'cumprido', cumprido_em: new Date().toISOString() } },
      {
        onSuccess: () => avisar('Prazo marcado como cumprido.', 'ok'),
        onError: (erro) => avisar(`Não foi possível atualizar: ${mensagemDeErro(erro)}`, 'erro'),
      },
    )
  }

  return (
    <>
      <Indicadores
        contagem={contarIndicadores(todos, hoje)}
        ativo={rapido}
        onSelecionar={(filtro) => {
          setRapido(filtro)
          if (filtro) setStatus('abertos')
        }}
      />

      <section className="rounded-xl border border-line bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-line p-3.5">
          <input
            type="search"
            aria-label="Buscar prazos"
            placeholder="Buscar processo, tribunal, parte, texto…"
            className={`${campo} max-w-xs`}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <select
            aria-label="Filtrar por status"
            className={`${campo} max-w-44`}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as FiltroStatus)
              setRapido(null)
            }}
          >
            {OPCOES_STATUS.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
          {filtrando && (
            <button
              type="button"
              className={botaoPequeno}
              onClick={() => {
                setBusca('')
                setStatus('abertos')
                setRapido(null)
              }}
            >
              Limpar filtros
            </button>
          )}
          <span className="ml-auto text-sm text-muted">
            {lista.length} {lista.length === 1 ? 'prazo' : 'prazos'}
          </span>
        </div>

        <TabelaPrazos
          prazos={lista}
          hoje={hoje}
          onAbrir={abrirPrazo}
          onCumprir={cumprir}
          cumprindo={atualizar.isPending ? atualizar.variables?.id : null}
          vazio={
            todos.length === 0 ? (
              <GuiaInicio
                temMonitoramento={(monitoramentos.data ?? []).length > 0}
                temWebhook={Boolean(config.data?.n8n_webhook_url)}
                onPrazoManual={() => novoPrazo()}
              />
            ) : (
              'Nenhum prazo com esses filtros.'
            )
          }
        />
      </section>
    </>
  )
}
