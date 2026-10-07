import { useState } from 'react'
import FiltroResponsavel from '../components/FiltroResponsavel'
import GuiaInicio from '../components/GuiaInicio'
import Indicadores from '../components/Indicadores'
import TabelaPrazos from '../components/TabelaPrazos'
import { alertaErro, botaoPequeno, campo } from '../components/ui'
import { usePlano } from '../data/plano'
import { useAtualizarPrazo, useConfiguracaoSistema, useMonitoramentos, usePrazos } from '../data/queries'
import { useFiltroResponsavel } from '../data/responsaveis'
import { filtrarPorResponsavel, filtrarPrazos, type FiltroRapido, type FiltroStatus } from '../domain/filtros'
import { contarIndicadores } from '../domain/indicadores'
import { useUserId } from '../lib/auth-context'
import type { Prazo } from '../lib/database.types'
import { useLayout } from '../lib/layout-context'
import { useOrganizacaoId, usePode } from '../lib/organizacao-context'
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
  const orgId = useOrganizacaoId()
  const eu = useUserId()
  const { hoje, abrirPrazo, novoPrazo } = useLayout()
  const avisar = useToast()
  const prazos = usePrazos(orgId)
  const monitoramentos = useMonitoramentos(orgId)
  const sistema = useConfiguracaoSistema()
  const atualizar = useAtualizarPrazo(orgId)
  const filtroResponsavel = useFiltroResponsavel(orgId, eu)
  const permite = usePode()
  const { escrita } = usePlano()

  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState<FiltroStatus>('abertos')
  const [rapido, setRapido] = useState<FiltroRapido>(null)

  if (prazos.isPending) {
    return (
      <div aria-busy="true">
        <span className="sr-only">Carregando prazos…</span>
        <div className="mb-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="ds-skeleton h-24" />
          ))}
        </div>
        <div className="ds-card space-y-3 p-5">
          <div className="ds-skeleton h-10 w-1/2" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="ds-skeleton h-12" />
          ))}
        </div>
      </div>
    )
  }
  if (prazos.isError) {
    return (
      <div className={alertaErro}>
        Não foi possível carregar os prazos: {mensagemDeErro(prazos.error)}{' '}
        <button type="button" className="ml-2 font-semibold underline" onClick={() => void prazos.refetch()}>
          Tentar de novo
        </button>
      </div>
    )
  }

  const todos = prazos.data
  const doResponsavel = filtrarPorResponsavel(todos, filtroResponsavel.responsavel)
  const lista = filtrarPrazos(doResponsavel, { busca, status, rapido, hoje })
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
        contagem={contarIndicadores(doResponsavel, hoje)}
        ativo={rapido}
        onSelecionar={(filtro) => {
          setRapido(filtro)
          if (filtro) setStatus('abertos')
        }}
      />

      <section className="ds-card overflow-hidden">
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
          <FiltroResponsavel filtro={filtroResponsavel} eu={eu} />
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
          responsaveis={filtroResponsavel.nomes}
          podeCumprir={escrita && permite('cumprir_prazo')}
          vazio={
            todos.length === 0 ? (
              <GuiaInicio
                temMonitoramento={(monitoramentos.data ?? []).length > 0}
                temWebhook={Boolean(sistema.data?.n8n_webhook_url.trim())}
                onPrazoManual={() => novoPrazo()}
              />
            ) : doResponsavel.length === 0 && filtroResponsavel.responsavel === eu ? (
              'Nenhum prazo sob sua responsabilidade. Escolha "Todos os responsáveis" para ver os da equipe.'
            ) : (
              'Nenhum prazo com esses filtros.'
            )
          }
        />
      </section>
    </>
  )
}
