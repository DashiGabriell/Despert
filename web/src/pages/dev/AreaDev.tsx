import { useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import BotaoInstalarApp from '../../components/InstalarApp'
import { BarraAbas, BotaoFolha, FolhaApp, LinkFolha } from '../../components/NavegacaoApp'
import { alertaAviso, botaoPequeno } from '../../components/ui'
import { MODOS_DEV, rotaDev, type ModoDev } from '../../domain/acesso'
import { useAuth } from '../../lib/auth-context'
import { ICONE_SAIR, useRolagemAoTopo } from '../../lib/navegacao'
import { ausenciaConfiguracao } from '../../lib/supabase'

const ICONES: Record<ModoDev, string> = {
  'visao-geral': 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  usuarios: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  organizacoes: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01',
  dados: 'M12 3c4.97 0 9 1.34 9 3s-4.03 3-9 3-9-1.34-9-3 4.03-3 9-3zM21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 6v12c0 1.66 4 3 9 3s9-1.34 9-3V6',
  execucoes: 'M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8M12 7v5l4 2',
  n8n: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  auditoria: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
}

/** No celular estes modos ficam na barra de abas; o resto mora na folha "Mais". */
const ABAS_CELULAR: readonly ModoDev[] = ['visao-geral', 'usuarios', 'organizacoes', 'execucoes']
const ROTULO_CURTO: Partial<Record<ModoDev, string>> = { 'visao-geral': 'Visão', organizacoes: 'Orgs' }

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

/** Guarda e moldura do painel dev. Quem não é dev cai nos prazos, como numa rota desconhecida. */
export default function AreaDev() {
  const { sessao, papel } = useAuth()
  if (sessao === undefined) {
    return <main className="grid min-h-dvh place-items-center text-sm text-muted">Carregando…</main>
  }
  if (!sessao) return <Navigate to="/login" replace />
  if (papel !== 'dev') return <Navigate to="/prazos" replace />
  return <MolduraDev email={sessao.user.email ?? ''} />
}

function MolduraDev({ email }: { email: string }) {
  const { sair, atuacao, encerrarAtuacao } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useRolagemAoTopo()
  const [maisAberta, setMaisAberta] = useState(false)
  const fecharMais = () => setMaisAberta(false)
  const modosDaFolha = MODOS_DEV.filter((item) => !ABAS_CELULAR.includes(item.modo))

  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)]">
      <div className="app-topo md:hidden">
        <span className="ds-marca size-9 rounded-[10px]">D</span>
        <span className="min-w-0 leading-tight">
          <span className="block font-display text-xl font-bold text-navy">Despert</span>
          <span className="block text-[11px] tracking-wider text-muted uppercase">Painel dev</span>
        </span>
        <button
          type="button"
          className="ml-auto grid size-11 place-items-center rounded-full"
          aria-label="Conta e mais opções"
          onClick={() => setMaisAberta(true)}
        >
          <span className="ds-avatar">{(email[0] ?? '?').toUpperCase()}</span>
        </button>
      </div>

      <aside className="ds-sidebar max-md:hidden">
        <div className="ds-sb-cabeca flex items-center gap-2.5">
          <span className="ds-marca">D</span>
          <span className="ds-sb-texto leading-tight">
            <span className="block font-display text-2xl font-bold text-navy">Despert</span>
            <span className="block text-[11px] tracking-wider text-muted uppercase">Painel dev</span>
          </span>
        </div>

        <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible" aria-label="Painel dev">
          {MODOS_DEV.map((item) => (
            <NavLink key={item.modo} to={rotaDev(item.modo)} className="ds-sb-item">
              <Icone d={ICONES[item.modo]} />
              <span className="ds-sb-texto">{item.rotulo}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto hidden flex-col gap-2 border-t border-line pt-4 md:flex">
          <div className="ds-sb-usuario flex items-center gap-2.5 px-1" title={email}>
            <span className="ds-avatar">{(email[0] ?? '?').toUpperCase()}</span>
            <span className="ds-sb-texto min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="block truncate text-sm font-semibold text-ink">{email.split('@')[0]}</span>
                <span className="ds-badge ds-badge-navy px-1.5 text-[10px]">dev</span>
              </span>
              <span className="block truncate text-[11px] text-muted">{email}</span>
            </span>
          </div>
          <button type="button" onClick={() => void sair()} className="ds-sb-logout" title="Sair">
            <Icone d={ICONE_SAIR} />
            <span className="ds-sb-texto">Sair</span>
          </button>
        </div>
      </aside>

      <main className="com-abas min-w-0 px-4 py-5 md:px-8 md:py-8">
        {ausenciaConfiguracao && <div className={`${alertaAviso} mb-5`}>{ausenciaConfiguracao}</div>}
        {atuacao && (
          <div role="status" className={`${alertaAviso} mb-5 flex flex-wrap items-center justify-between gap-3`}>
            <span>
              Você ainda está atuando como <strong>{atuacao.email}</strong>.
            </span>
            <span className="flex gap-2">
              <button type="button" className={botaoPequeno} onClick={() => navigate('/prazos')}>
                Continuar como advogado
              </button>
              <button type="button" className={botaoPequeno} onClick={encerrarAtuacao}>
                Encerrar atuação
              </button>
            </span>
          </div>
        )}
        <Outlet />
      </main>

      <BarraAbas
        rotulo="Painel dev no celular"
        abas={ABAS_CELULAR.map((modo) => {
          const rotulo = MODOS_DEV.find((m) => m.modo === modo)!.rotulo
          return {
            to: rotaDev(modo),
            rotulo: ROTULO_CURTO[modo] ?? rotulo,
            rotuloCompleto: ROTULO_CURTO[modo] ? rotulo : undefined,
            d: ICONES[modo],
          }
        })}
        maisAberta={maisAberta}
        maisAtiva={modosDaFolha.some((item) => pathname === rotaDev(item.modo))}
        onMais={() => setMaisAberta(true)}
      />

      <FolhaApp
        aberta={maisAberta}
        onFechar={fecharMais}
        titulo="Painel dev"
        subtitulo={email}
        icone={<span className="ds-avatar size-11 text-base">{(email[0] ?? '?').toUpperCase()}</span>}
      >
        <nav className="app-folha-grupo" aria-label="Mais ferramentas">
          {modosDaFolha.map((item) => (
            <LinkFolha
              key={item.modo}
              to={rotaDev(item.modo)}
              rotulo={item.rotulo}
              d={ICONES[item.modo]}
              onClick={fecharMais}
            />
          ))}
        </nav>
        <div className="app-folha-grupo">
          <BotaoInstalarApp />
          <BotaoFolha rotulo="Sair" d={ICONE_SAIR} perigo onClick={() => void sair()} />
        </div>
      </FolhaApp>
    </div>
  )
}
