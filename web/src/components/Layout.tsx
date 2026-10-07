import { useCallback, useMemo, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  useAtualizarPrazo,
  useConfiguracao,
  useConfiguracaoSistema,
  useCriarPrazo,
  useExcluirPrazo,
  useExecucoes,
  useFeriados,
  useMonitoramentos,
  usePertencas,
  usePrazos,
  useTempoReal,
} from '../data/queries'
import { useHoje } from '../data/relogio'
import { rotaDev, type Atuacao } from '../domain/acesso'
import { formatarDataHora } from '../domain/datas'
import type { DataISO, OpcoesDias } from '../domain/dias'
import { contarIndicadores } from '../domain/indicadores'
import { organizacaoAtiva } from '../domain/organizacao'
import { useAuth, useEmailEfetivo, useUserId } from '../lib/auth-context'
import type { Prazo } from '../lib/database.types'
import type { ContextoLayout } from '../lib/layout-context'
import { OrganizacaoContext, useOrganizacaoId } from '../lib/organizacao-context'
import { ausenciaConfiguracao } from '../lib/supabase'
import { mensagemDeErro, useToast } from '../lib/toast-context'
import BuscaAgora from './BuscaAgora'
import ModalNovoPrazo from './ModalNovoPrazo'
import ModalPrazo from './ModalPrazo'
import { alertaAviso, alertaErro, botao, botaoPequeno } from './ui'

const CHAVE_MENU_RECOLHIDO = 'despert:menu-recolhido'

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
  const { sessao, papel, atuacao } = useAuth()
  if (sessao === undefined) {
    return (
      <main className="grid min-h-dvh place-items-center text-sm text-muted">
        Carregando…
      </main>
    )
  }
  if (!sessao) return <Navigate to="/login" replace />
  // O dev não é advogado: só usa estas telas quando está atuando como um.
  if (papel === 'dev' && !atuacao) return <Navigate to={rotaDev()} replace />
  return <AreaLogada />
}

function FaixaAtuacao({ atuacao }: { atuacao: Atuacao }) {
  const { encerrarAtuacao } = useAuth()
  const navigate = useNavigate()
  return (
    <div role="status" className={`${alertaAviso} mb-5 flex flex-wrap items-center justify-between gap-3`}>
      <span>
        <strong>Modo dev:</strong> você está atuando como <strong>{atuacao.email}</strong>. Tudo o que fizer
        aqui é gravado na conta dele e registrado na auditoria.
      </span>
      <button
        type="button"
        className={botaoPequeno}
        onClick={() => {
          encerrarAtuacao()
          navigate(rotaDev('usuarios'))
        }}
      >
        Voltar ao painel dev
      </button>
    </div>
  )
}

function AreaLogada() {
  const userId = useUserId()
  const pertencas = usePertencas(userId)
  const pertenca = organizacaoAtiva(pertencas.data ?? [])

  if (pertencas.isPending) {
    return <main className="grid min-h-dvh place-items-center text-sm text-muted">Carregando…</main>
  }
  if (!pertenca) {
    return (
      <main className="grid min-h-dvh place-items-center p-5">
        <div role="alert" className={`${alertaErro} max-w-md`}>
          {pertencas.isError
            ? `Não foi possível carregar sua organização: ${mensagemDeErro(pertencas.error)}`
            : 'Sua conta não está vinculada a nenhum escritório. Fale com o suporte.'}
        </div>
      </main>
    )
  }
  return (
    <OrganizacaoContext.Provider value={pertenca}>
      <AreaDaOrganizacao />
    </OrganizacaoContext.Provider>
  )
}

function AreaDaOrganizacao() {
  const userId = useUserId()
  const orgId = useOrganizacaoId()
  const email = useEmailEfetivo() ?? ''
  const { sair, atuacao } = useAuth()
  const { pathname } = useLocation()
  const avisar = useToast()
  const hoje = useHoje()
  useTempoReal(orgId)

  const prazos = usePrazos(orgId)
  const execucoes = useExecucoes(orgId)
  const config = useConfiguracao(userId, email)
  const sistema = useConfiguracaoSistema()
  const monitoramentos = useMonitoramentos(orgId)
  const feriados = useFeriados(orgId)
  const atualizar = useAtualizarPrazo(orgId)
  const excluir = useExcluirPrazo(orgId)
  const criar = useCriarPrazo(orgId, userId)

  const [modal, setModal] = useState<ModalAberto>(null)
  const fechar = useCallback(() => setModal(null), [])
  const [recolhida, setRecolhida] = useState(() => localStorage.getItem(CHAVE_MENU_RECOLHIDO) === '1')
  const alternarRecolhida = () =>
    setRecolhida((atual) => {
      localStorage.setItem(CHAVE_MENU_RECOLHIDO, atual ? '0' : '1')
      return !atual
    })

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
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)]">
      <aside className="ds-sidebar" data-recolhida={recolhida}>
        <div className="ds-sb-cabeca flex items-center gap-2.5">
          <img src="/logo-despert-256.png" alt="Despert" className="size-11 shrink-0 object-contain" />
          <span className="ds-sb-texto leading-tight" aria-hidden>
            <span className="block font-display text-2xl font-bold text-navy">Despert</span>
            <span className="block text-[11px] tracking-wider text-muted uppercase">DJEN · CNJ</span>
          </span>
          <button
            type="button"
            onClick={alternarRecolhida}
            className="ds-sb-toggle ml-auto max-md:hidden"
            aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'}
            title={recolhida ? 'Expandir menu' : 'Recolher menu'}
          >
            <Icone d="M15 18l-6-6 6-6" />
          </button>
          <button type="button" onClick={() => void sair()} className={`${botaoPequeno} ml-auto md:hidden`}>
            Sair
          </button>
        </div>

        <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {ITENS.map((item) => (
            <NavLink key={item.to} to={item.to} className="ds-sb-item" title={recolhida ? item.label : undefined}>
              <Icone d={item.d} />
              <span className="ds-sb-texto">{item.label}</span>
              {item.to === '/prazos' && criticos > 0 && (
                <span
                  className={`ds-badge ds-badge-solido px-1.5 text-[11px] ${recolhida ? 'absolute top-0.5 right-1' : 'ml-auto'}`}
                  title="Vencidos e vencendo hoje"
                >
                  {criticos}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto hidden flex-col gap-2 border-t border-line pt-4 md:flex">
          <div className="ds-sb-usuario flex items-center gap-2.5 px-1" title={email}>
            <span className="ds-avatar">{(email[0] ?? '?').toUpperCase()}</span>
            <span className="ds-sb-texto min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{email.split('@')[0]}</span>
              <span className="block truncate text-[11px] text-muted">{email}</span>
            </span>
          </div>
          <button type="button" onClick={() => void sair()} className="ds-sb-logout" title="Sair">
            <Icone d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            <span className="ds-sb-texto">Sair</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-5 md:px-8 md:py-8">
        {ausenciaConfiguracao && <div className={`${alertaAviso} mb-5`}>{ausenciaConfiguracao}</div>}
        {atuacao && <FaixaAtuacao atuacao={atuacao} />}

        <header className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-4xl leading-tight font-bold text-navy">{TITULOS[pathname] ?? 'Despert'}</h1>
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
            <BuscaAgora
              userId={userId}
              orgId={orgId}
              config={config.data}
              webhookUrl={sistema.data?.n8n_webhook_url}
              monitoramentos={monitoramentos.data ?? []}
            />
          </div>
        </header>

        <div key={pathname} className="ds-entrar">
          <Outlet context={contexto} />
        </div>
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
