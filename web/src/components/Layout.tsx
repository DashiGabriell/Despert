import type { Session } from '@supabase/supabase-js'
import { useCallback, useMemo, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  useAtualizarPrazo,
  useConfiguracao,
  useCriarPrazo,
  useExcluirPrazo,
  useExecucoes,
  useFeriados,
  useMonitoramentos,
  usePrazos,
  useTempoReal,
} from '../data/queries'
import { useHoje } from '../data/relogio'
import { formatarDataHora } from '../domain/datas'
import type { DataISO, OpcoesDias } from '../domain/dias'
import { contarIndicadores } from '../domain/indicadores'
import { useAuth } from '../lib/auth-context'
import type { Prazo } from '../lib/database.types'
import type { ContextoLayout } from '../lib/layout-context'
import { ausenciaConfiguracao } from '../lib/supabase'
import { useToast } from '../lib/toast-context'
import BuscaAgora from './BuscaAgora'
import ModalNovoPrazo from './ModalNovoPrazo'
import ModalPrazo from './ModalPrazo'
import { botao } from './ui'

const TITULOS: Record<string, string> = {
  '/prazos': 'Prazos',
  '/agenda': 'Agenda',
  '/monitoramento': 'Monitoramento',
  '/historico': 'Histórico de execuções',
  '/configuracoes': 'Configurações',
}

function Icone({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="size-4.5 shrink-0"
    >
      <path d={d} />
    </svg>
  )
}

const ITENS = [
  {
    to: '/prazos',
    label: 'Prazos',
    d: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  },
  { to: '/agenda', label: 'Agenda', d: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18' },
  {
    to: '/monitoramento',
    label: 'Monitoramento',
    d: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3',
  },
  { to: '/historico', label: 'Histórico', d: 'M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8M12 7v5l4 2' },
  {
    to: '/configuracoes',
    label: 'Configurações',
    d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  },
]

type ModalAberto = { tipo: 'prazo'; id: string } | { tipo: 'novo'; data?: DataISO } | null

export default function Layout() {
  const { sessao } = useAuth()
  if (sessao === undefined) {
    return (
      <main className="grid min-h-dvh place-items-center bg-surface text-sm text-muted">
        Carregando…
      </main>
    )
  }
  if (!sessao) return <Navigate to="/login" replace />
  return <AreaLogada sessao={sessao} />
}

function AreaLogada({ sessao }: { sessao: Session }) {
  const userId = sessao.user.id
  const { sair } = useAuth()
  const { pathname } = useLocation()
  const avisar = useToast()
  const hoje = useHoje()
  useTempoReal(userId)

  const prazos = usePrazos(userId)
  const execucoes = useExecucoes(userId)
  const config = useConfiguracao(userId, sessao.user.email)
  const monitoramentos = useMonitoramentos(userId)
  const feriados = useFeriados(userId)
  const atualizar = useAtualizarPrazo(userId)
  const excluir = useExcluirPrazo(userId)
  const criar = useCriarPrazo(userId)

  const [modal, setModal] = useState<ModalAberto>(null)
  const fechar = useCallback(() => setModal(null), [])

  const opcoesDias: OpcoesDias = useMemo(
    () => ({
      feriadosLocais: (feriados.data ?? []).map((f) => f.data),
      considerarRecesso: config.data?.considerar_recesso ?? true,
    }),
    [feriados.data, config.data?.considerar_recesso],
  )

  const contexto: ContextoLayout = useMemo(
    () => ({
      hoje,
      abrirPrazo: (prazo: Prazo) => setModal({ tipo: 'prazo', id: prazo.id }),
      novoPrazo: (data?: DataISO) => setModal({ tipo: 'novo', data }),
    }),
    [hoje],
  )

  const indicadores = contarIndicadores(prazos.data ?? [], hoje)
  const criticos = indicadores.vencido + indicadores.hoje
  const ultima = execucoes.data?.[0]
  const prazoAberto =
    modal?.tipo === 'prazo' ? (prazos.data ?? []).find((p) => p.id === modal.id) : undefined

  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-4 bg-navy p-3 text-white/80 md:sticky md:top-0 md:h-dvh md:gap-6 md:p-4">
        <div className="flex items-center gap-2.5 px-2">
          <span className="grid size-8 place-items-center rounded-lg bg-gold text-sm font-bold text-white">
            D
          </span>
          <span className="leading-tight">
            <span className="block text-base font-bold text-white">Despert</span>
            <span className="block text-[11px] text-white/50">DJEN · CNJ</span>
          </span>
          <button
            type="button"
            onClick={() => void sair()}
            className="ml-auto cursor-pointer rounded-md border border-white/20 px-2.5 py-1 text-xs md:hidden"
          >
            Sair
          </button>
        </div>

        <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {ITENS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                  isActive ? 'bg-white/15 text-white' : 'hover:bg-white/10 hover:text-white',
                ].join(' ')
              }
            >
              <Icone d={item.d} />
              {item.label}
              {item.to === '/prazos' && criticos > 0 && (
                <span
                  className="ml-auto rounded-full bg-danger px-1.5 text-[11px] text-white"
                  title="Vencidos e vencendo hoje"
                >
                  {criticos}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto hidden border-t border-white/10 pt-4 text-xs text-white/60 md:block">
          <div className="truncate" title={sessao.user.email}>
            {sessao.user.email}
          </div>
          <button
            type="button"
            onClick={() => void sair()}
            className="mt-2.5 w-full cursor-pointer rounded-lg border border-white/20 py-1.5 text-white/80 hover:bg-white/10"
          >
            Sair
          </button>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-5 md:px-7 md:py-7">
        {ausenciaConfiguracao && (
          <div className="mb-5 rounded-lg border border-caution/30 bg-caution-soft px-4 py-3 text-sm text-caution">
            {ausenciaConfiguracao}
          </div>
        )}

        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy">{TITULOS[pathname] ?? 'Despert'}</h1>
            <p className="mt-1 text-sm text-muted">
              {ultima ? (
                <>
                  Última verificação: {formatarDataHora(ultima.executado_em)} —{' '}
                  {ultima.status === 'falha' ? (
                    <strong className="text-danger">falhou</strong>
                  ) : (
                    `${ultima.novas} nova(s)`
                  )}
                </>
              ) : execucoes.isPending ? (
                'Carregando…'
              ) : (
                'O robô ainda não rodou nenhuma vez.'
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={botao} onClick={() => contexto.novoPrazo()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              Prazo manual
            </button>
            <BuscaAgora userId={userId} config={config.data} monitoramentos={monitoramentos.data ?? []} />
          </div>
        </header>

        <Outlet context={contexto} />
      </main>

      {prazoAberto && (
        <ModalPrazo
          key={prazoAberto.id}
          prazo={prazoAberto}
          hoje={hoje}
          opcoesDias={opcoesDias}
          onFechar={fechar}
          onSalvar={async (dados) => {
            await atualizar.mutateAsync({ id: prazoAberto.id, dados })
            avisar(
              dados.status === 'cumprido' && prazoAberto.status !== 'cumprido'
                ? 'Prazo marcado como cumprido.'
                : 'Prazo atualizado.',
              'ok',
            )
            fechar()
          }}
          onExcluir={async () => {
            await excluir.mutateAsync(prazoAberto.id)
            avisar('Prazo excluído.')
            fechar()
          }}
        />
      )}
      {modal?.tipo === 'novo' && (
        <ModalNovoPrazo
          dataInicial={modal.data}
          opcoesDias={opcoesDias}
          onFechar={fechar}
          onCriar={async (registro) => {
            await criar.mutateAsync({ ...registro, djen_id: `manual-${crypto.randomUUID()}` })
            avisar('Prazo criado.', 'ok')
            fechar()
          }}
        />
      )}
    </div>
  )
}
