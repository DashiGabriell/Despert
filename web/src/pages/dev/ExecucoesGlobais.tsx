import { useState } from 'react'
import { alertaErro, campo, cartao, rotulo, tabela, vazioTabela } from '../../components/ui'
import { useContasAdmin, useExecucoesGlobais } from '../../data/admin'
import { formatarDataHora } from '../../domain/datas'
import { mensagemDeErro } from '../../lib/toast-context'

const SEM_CONTA = 'geral'

export default function ExecucoesGlobais() {
  const execucoes = useExecucoesGlobais()
  const contas = useContasAdmin()
  const [status, setStatus] = useState<'todas' | 'ok' | 'falha'>('todas')
  const [conta, setConta] = useState('')

  const emailPorId = new Map((contas.data ?? []).map((c) => [c.id, c.email]))
  const lista = (execucoes.data ?? []).filter(
    (x) =>
      (status === 'todas' || x.status === status) &&
      (!conta || (conta === SEM_CONTA ? x.user_id === null : x.user_id === conta)),
  )

  return (
    <section className={cartao}>
      <div className="flex flex-wrap items-end gap-3 border-b border-line px-4 py-3">
        <div>
          <label className={rotulo} htmlFor="e-status">
            Status
          </label>
          <select
            id="e-status"
            className={campo}
            value={status}
            onChange={(e) => setStatus(e.target.value === 'ok' || e.target.value === 'falha' ? e.target.value : 'todas')}
          >
            <option value="todas">Todas</option>
            <option value="ok">OK</option>
            <option value="falha">Falhas</option>
          </select>
        </div>
        <div className="min-w-60">
          <label className={rotulo} htmlFor="e-conta">
            Conta
          </label>
          <select id="e-conta" className={campo} value={conta} onChange={(e) => setConta(e.target.value)}>
            <option value="">Todas as contas</option>
            <option value={SEM_CONTA}>Geral (sem conta)</option>
            {(contas.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.email}
              </option>
            ))}
          </select>
        </div>
        <p className="ml-auto text-sm text-muted">
          {lista.length} de {execucoes.data?.length ?? 0} (últimas 300, atualiza a cada 30 s)
        </p>
      </div>
      {execucoes.isError && (
        <div className={`${alertaErro} m-3.5`}>Não foi possível carregar: {mensagemDeErro(execucoes.error)}</div>
      )}
      <div className="overflow-x-auto">
        <table className={tabela}>
          <thead>
            <tr>
              <th>Data / hora</th>
              <th>Conta</th>
              <th>Origem</th>
              <th>Encontradas</th>
              <th>Novas</th>
              <th>Status</th>
              <th>Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {execucoes.isPending && (
              <tr>
                <td colSpan={7} className="space-y-2.5 py-5">
                  <span className="sr-only">Carregando…</span>
                  <div className="ds-skeleton h-4 w-3/4" />
                  <div className="ds-skeleton h-4 w-1/2" />
                </td>
              </tr>
            )}
            {execucoes.isSuccess && lista.length === 0 && (
              <tr>
                <td colSpan={7} className={vazioTabela}>
                  Nenhuma execução com esses filtros.
                </td>
              </tr>
            )}
            {lista.map((x) => (
              <tr key={x.id}>
                <td className="whitespace-nowrap">{formatarDataHora(x.executado_em)}</td>
                <td className="break-all">{x.user_id ? (emailPorId.get(x.user_id) ?? x.user_id) : 'Geral'}</td>
                <td>{x.origem ?? '—'}</td>
                <td>{x.encontradas}</td>
                <td>{x.novas}</td>
                <td>
                  {x.status === 'ok' ? (
                    <span className="ds-badge ds-badge-success">OK</span>
                  ) : (
                    <span className="ds-badge ds-badge-destructive">Falha</span>
                  )}
                </td>
                <td className="max-w-md text-xs break-words text-muted">{(x.detalhe ?? '').slice(0, 300)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
