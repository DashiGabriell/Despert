import type { ReactNode } from 'react'
import { formatarData } from '../domain/datas'
import type { DataISO } from '../domain/dias'
import { emAberto, precisaConferir } from '../domain/urgencia'
import type { Prazo } from '../lib/database.types'
import SeloPrazo from './SeloPrazo'
import { botaoSucessoPequeno, tabela, vazioTabela } from './ui'

interface Props {
  prazos: Prazo[]
  hoje: DataISO
  vazio: ReactNode
  onAbrir: (prazo: Prazo) => void
  onCumprir: (prazo: Prazo) => void
  cumprindo?: string | null
  /** Nome de cada responsável (id → nome); sem ele (Solo) a coluna não aparece. */
  responsaveis?: ReadonlyMap<string, string>
  podeCumprir?: boolean
}

export default function TabelaPrazos({
  prazos,
  hoje,
  vazio,
  onAbrir,
  onCumprir,
  cumprindo,
  responsaveis,
  podeCumprir = true,
}: Props) {
  const colunas = responsaveis ? 8 : 7
  return (
    <div className="overflow-x-auto">
      <table className={`${tabela} tabela-prazos`}>
        <thead>
          <tr>
            <th>Situação</th>
            <th>Vencimento</th>
            <th>Processo</th>
            <th>Tribunal / Órgão</th>
            <th>Tipo</th>
            <th>Prazo</th>
            {responsaveis && <th>Responsável</th>}
            <th>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {prazos.length === 0 && (
            <tr>
              <td colSpan={colunas} className={vazioTabela}>
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
                data-conferir={conferir || undefined}
                className={`ds-linha-clicavel ${aberto ? '' : '[&>td]:text-muted'} ${conferir ? 'md:[&>td:first-child]:shadow-[inset_3px_0_0_var(--color-gold)]' : ''}`}
              >
                <td data-area="selo">
                  <SeloPrazo prazo={prazo} hoje={hoje} />
                </td>
                <td data-area="venc">
                  <strong>{formatarData(prazo.vencimento)}</strong>
                  {prazo.data_publicacao && (
                    <div className="mt-0.5 text-xs text-muted">Publ. {formatarData(prazo.data_publicacao)}</div>
                  )}
                </td>
                <td data-area="proc">
                  <span className="font-mono text-[13px]">{prazo.processo || '—'}</span>
                  {prazo.classe && <div className="mt-0.5 text-xs text-muted">{prazo.classe}</div>}
                </td>
                <td data-area="trib">
                  {prazo.tribunal}
                  {prazo.orgao && <div className="mt-0.5 text-xs text-muted">{prazo.orgao}</div>}
                </td>
                <td data-area="tipo">{prazo.tipo}</td>
                <td data-area="prazo" className="whitespace-nowrap">
                  {prazo.prazo_dias ? `${prazo.prazo_dias} dias` : '—'}
                  {conferir && <div className="text-xs font-semibold text-alert">conferir</div>}
                </td>
                {responsaveis && (
                  <td data-area="resp" className="whitespace-nowrap">
                    {prazo.responsavel_id ? (responsaveis.get(prazo.responsavel_id) ?? 'Fora da equipe') : '—'}
                  </td>
                )}
                <td data-area="acao" className="text-right">
                  {aberto && podeCumprir && (
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
