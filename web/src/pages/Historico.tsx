import { alertaErro, cartao, tabela, vazioTabela } from '../components/ui'
import { useExecucoes } from '../data/queries'
import { formatarDataHora } from '../domain/datas'
import { useUserId } from '../lib/auth-context'
import { mensagemDeErro } from '../lib/toast-context'

const ORIGENS: Record<string, string> = {
  agendado: 'Automática (07:00)',
  manual: 'Manual no n8n',
  site: 'Buscar agora',
}

export default function Historico() {
  const userId = useUserId()
  const execucoes = useExecucoes(userId)
  const lista = execucoes.data ?? []

  return (
    <section className={cartao}>
      {execucoes.isError && (
        <div className={`${alertaErro} m-3.5`}>
          Não foi possível carregar o histórico: {mensagemDeErro(execucoes.error)}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className={tabela}>
          <thead>
            <tr>
              <th>Data / hora</th>
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
                <td colSpan={6} className="space-y-2.5 py-5">
                  <span className="sr-only">Carregando…</span>
                  <div className="ds-skeleton h-4 w-3/4" />
                  <div className="ds-skeleton h-4 w-1/2" />
                  <div className="ds-skeleton h-4 w-2/3" />
                </td>
              </tr>
            )}
            {execucoes.isSuccess && lista.length === 0 && (
              <tr>
                <td colSpan={6} className={vazioTabela}>
                  Nenhuma execução registrada. Use <strong>Buscar agora</strong> ou aguarde a rodada das
                  07:00 em dia útil.
                </td>
              </tr>
            )}
            {lista.map((x) => (
              <tr key={x.id}>
                <td className={`whitespace-nowrap`}>{formatarDataHora(x.executado_em)}</td>
                <td>{ORIGENS[x.origem ?? ''] ?? x.origem ?? '—'}</td>
                <td>{x.encontradas}</td>
                <td>
                  <strong>{x.novas}</strong>
                </td>
                <td>
                  {x.status === 'ok' ? (
                    <span className="ds-badge ds-badge-success">OK</span>
                  ) : (
                    <span className="ds-badge ds-badge-destructive">Falha</span>
                  )}
                </td>
                <td className={`max-w-md text-xs break-words text-muted`}>
                  {(x.detalhe ?? '').slice(0, 300)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
