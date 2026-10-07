import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ausenciaConfiguracao } from '../lib/supabase'

const TITULOS: Record<string, string> = {
  '/prazos': 'Prazos',
  '/agenda': 'Agenda',
  '/monitoramento': 'Monitoramento',
  '/historico': 'Histórico de execuções',
  '/configuracoes': 'Configurações',
}

const SUBTITULOS: Record<string, string> = {
  '/prazos': 'Publicações do Diário de Justiça Eletrônico Nacional',
  '/agenda': 'Vencimentos do mês, um por dia',
  '/monitoramento': 'OAB e processos que o robô acompanha',
  '/historico': 'Quando o robô rodou e o que encontrou',
  '/configuracoes': 'Parâmetros do robô, webhook e feriados',
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

export default function Layout() {
  const { pathname } = useLocation()

  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-6 bg-navy p-4 text-white/80 md:sticky md:top-0 md:h-dvh">
        <div className="flex items-center gap-2.5 px-2">
          <span className="grid size-8 place-items-center rounded-lg bg-gold text-sm font-bold text-white">
            D
          </span>
          <span className="leading-tight">
            <span className="block text-base font-bold text-white">Despert</span>
            <span className="block text-[11px] text-white/50">DJEN · CNJ</span>
          </span>
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
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto hidden border-t border-white/10 pt-4 text-xs text-white/60 md:block">
          Conta conectada ao Supabase
        </div>
      </aside>

      <main className="min-w-0 px-5 py-6 md:px-7 md:py-8">
        {ausenciaConfiguracao && (
          <div className="mb-5 rounded-lg border border-caution/30 bg-caution-soft px-4 py-3 text-sm text-caution">
            {ausenciaConfiguracao}
          </div>
        )}

        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy">
              {TITULOS[pathname] ?? 'Despert'}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {SUBTITULOS[pathname] ?? ''}
            </p>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  )
}
