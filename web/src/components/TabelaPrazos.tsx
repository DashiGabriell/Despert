import type { ReactNode } from 'react'
import { formatarData } from '../domain/datas'
import type { DataISO } from '../domain/dias'
import { emAberto, precisaConferir } from '../domain/urgencia'
import type { Prazo } from '../lib/database.types'
import SeloPrazo from './SeloPrazo'
import { botaoSucessoPequeno, td, th } from './ui'

interface Props {
  prazos: Prazo[]
  hoje: DataISO
  vazio: ReactNode
  onAbrir: (prazo: Prazo) => void
  onCumprir: (prazo: Prazo) => void
  cumprindo?: string | null
}

export default function TabelaPrazos({ prazos, hoje, vazio, onAbrir, onCumprir, cumprindo }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={th}>Situação</th>
            <th className={th}>Vencimento</th>
            <th className={th}>Processo</th>
            <th className={th}>Tribunal / Órgão</th>
            <th className={th}>Tipo</th>
            <th className={th}>Prazo</th>
            <th className={th}>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {prazos.length === 0 && (
            <tr>
              <td colSpan={7} className="px-6 py-10 text-center text-muted">
                {vazio}
              </td>
            </tr>
          )}
          {prazos.map((prazo) => {
            const aberto = emAberto(prazo)
            const conferir = precisaConferir(prazo)
            return (
              <tr
                key={prazo.id}
                onClick={() => onAbrir(prazo)}
                className={`cursor-pointer hover:[&>td]:bg-[#fafbfd] ${aberto ? '' : '[&>td]:text-muted'} ${conferir ? '[&>td:first-child]:shadow-[inset_3px_0_0_var(--color-info)]' : ''}`}
              >
                <td className={td}>
                  <SeloPrazo prazo={prazo} hoje={hoje} />
                </td>
                <td className={td}>
                  <strong>{formatarData(prazo.vencimento)}</strong>
                  {prazo.data_publicacao && (
                    <div className="mt-0.5 text-xs text-muted">
                      Publ. {formatarData(prazo.data_publicacao)}
                    </div>
                  )}
                </td>
                <td className={td}>
                  <span className="font-mono text-[13px]">{prazo.processo || '—'}</span>
                  {prazo.classe && <div className="mt-0.5 text-xs text-muted">{prazo.classe}</div>}
                </td>
                <td className={td}>
                  {prazo.tribunal}
                  {prazo.orgao && <div className="mt-0.5 text-xs text-muted">{prazo.orgao}</div>}
                </td>
                <td className={td}>{prazo.tipo}</td>
                <td className={`${td} whitespace-nowrap`}>
                  {prazo.prazo_dias ? `${prazo.prazo_dias} dias` : '—'}
                  {conferir && <div className="text-xs font-medium text-info">conferir</div>}
                </td>
                <td className={`${td} text-right`}>
                  {aberto && (
                    <button
                      type="button"
                      className={botaoSucessoPequeno}
                      disabled={cumprindo === prazo.id}
                      title="Marcar como cumprido"
                      onClick={(e) => {
                        e.stopPropagation()
                        onCumprir(prazo)
                      }}
                    >
                      Cumprido
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
