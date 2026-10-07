import { alertaErro, cartao, td, th } from '../components/ui'
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
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={th}>Data / hora</th>
              <th className={th}>Origem</th>
              <th className={th}>Encontradas</th>
              <th className={th}>Novas</th>
              <th className={th}>Status</th>
              <th className={th}>Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {execucoes.isPending && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-muted">
                  Carregando…
                </td>
              </tr>
            )}
            {execucoes.isSuccess && lista.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-muted">
                  Nenhuma execução registrada. Use <strong>Buscar agora</strong> ou aguarde a rodada das
                  07:00 em dia útil.
                </td>
              </tr>
            )}
            {lista.map((x) => (
              <tr key={x.id}>
                <td className={`${td} whitespace-nowrap`}>{formatarDataHora(x.executado_em)}</td>
                <td className={td}>{ORIGENS[x.origem ?? ''] ?? x.origem ?? '—'}</td>
                <td className={td}>{x.encontradas}</td>
                <td className={td}>
                  <strong>{x.novas}</strong>
                </td>
                <td className={td}>
                  {x.status === 'ok' ? (
                    <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-semibold text-ok">OK</span>
                  ) : (
                    <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger">
                      Falha
                    </span>
                  )}
                </td>
                <td className={`${td} max-w-md text-xs break-words text-muted`}>
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
