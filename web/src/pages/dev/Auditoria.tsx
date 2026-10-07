import { useState } from 'react'
import { alertaErro, campo, cartao, tabela, vazioTabela } from '../../components/ui'
import { useAuditoria } from '../../data/admin'
import { descreverAcao, resumirDetalhe } from '../../domain/acesso'
import { formatarDataHora } from '../../domain/datas'
import { mensagemDeErro } from '../../lib/toast-context'

export default function Auditoria() {
  const auditoria = useAuditoria()
  const [busca, setBusca] = useState('')
  const termo = busca.trim().toLowerCase()
  const lista = (auditoria.data ?? []).filter(
    (r) =>
      !termo ||
      [r.dev_email, r.alvo_email, descreverAcao(r.acao)].some((t) => (t ?? '').toLowerCase().includes(termo)),
  )

  return (
    <section className={cartao}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <p className="text-sm text-muted">
          Tudo o que um dev faz em dados de advogados ou na configuração do sistema (últimos 300 registros).
        </p>
        <label className="w-full max-w-xs">
          <span className="sr-only">Filtrar auditoria</span>
          <input
            type="search"
            className={campo}
            placeholder="Filtrar por e-mail ou ação"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
      </div>
      {auditoria.isError && (
        <div className={`${alertaErro} m-3.5`}>Não foi possível carregar: {mensagemDeErro(auditoria.error)}</div>
      )}
      <div className="overflow-x-auto">
        <table className={tabela}>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Dev</th>
              <th>Ação</th>
              <th>Conta afetada</th>
              <th>Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {auditoria.isPending && (
              <tr>
                <td colSpan={5} className="space-y-2.5 py-5">
                  <span className="sr-only">Carregando…</span>
                  <div className="ds-skeleton h-4 w-3/4" />
                  <div className="ds-skeleton h-4 w-1/2" />
                </td>
              </tr>
            )}
            {auditoria.isSuccess && lista.length === 0 && (
              <tr>
                <td colSpan={5} className={vazioTabela}>
                  {termo ? 'Nenhum registro com esse filtro.' : 'Nenhuma ação registrada ainda.'}
                </td>
              </tr>
            )}
            {lista.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">{formatarDataHora(r.criado_em)}</td>
                <td className="break-all">{r.dev_email ?? '—'}</td>
                <td>{descreverAcao(r.acao)}</td>
                <td className="break-all">{r.alvo_email ?? (r.alvo_user_id ? r.alvo_user_id : '—')}</td>
                <td className="text-xs text-muted">{resumirDetalhe(r.detalhe) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
