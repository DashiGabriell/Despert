import { Link } from 'react-router-dom'
import { alertaAviso, alertaErro, alertaOk, cartao, tabela, vazioTabela } from '../../components/ui'
import { useContasAdmin, useExecucoesGlobais, useMetricasAdmin } from '../../data/admin'
import { useConfiguracaoSistema } from '../../data/queries'
import { rotaDev } from '../../domain/acesso'
import { formatarDataHora } from '../../domain/datas'
import { mensagemDeErro } from '../../lib/toast-context'

function Metrica({ rotulo, valor, detalhe, cor = 'text-navy' }: { rotulo: string; valor: number | string; detalhe?: string; cor?: string }) {
  return (
    <div className="ds-metric">
      <span className="ds-metric-label">{rotulo}</span>
      <strong className={`ds-metric-value font-display ${cor}`}>{valor}</strong>
      {detalhe && <span className="text-xs text-muted">{detalhe}</span>}
    </div>
  )
}

export default function VisaoGeral() {
  const metricas = useMetricasAdmin()
  const sistema = useConfiguracaoSistema()
  const execucoes = useExecucoesGlobais()
  const contas = useContasAdmin()

  const emailPorId = new Map((contas.data ?? []).map((c) => [c.id, c.email]))
  const falhas = (execucoes.data ?? []).filter((x) => x.status === 'falha').slice(0, 5)
  const m = metricas.data
  const webhook = sistema.data?.n8n_webhook_url.trim()

  return (
    <div className="space-y-6">
      {metricas.isError && (
        <div className={alertaErro}>
          Não foi possível carregar as métricas: {mensagemDeErro(metricas.error)}. Confira se o{' '}
          <code>schema.sql</code> atualizado foi aplicado e se você saiu e entrou de novo depois de virar dev.
        </div>
      )}

      {sistema.isSuccess &&
        (webhook ? (
          <div className={alertaOk}>
            Robô conectado: o botão Buscar agora usa <code className="break-all">{webhook}</code>.
          </div>
        ) : (
          <div className={alertaAviso}>
            O robô não está conectado: nenhum advogado consegue usar o Buscar agora.{' '}
            <Link className="font-semibold underline" to={rotaDev('n8n')}>
              Configurar o n8n
            </Link>
          </div>
        ))}

      {metricas.isPending ? (
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4" aria-busy="true">
          <span className="sr-only">Carregando métricas…</span>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="ds-skeleton h-24" />
          ))}
        </div>
      ) : (
        m && (
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            <Metrica rotulo="Contas" valor={m.contas} detalhe={`${m.devs} dev · ${m.contas_bloqueadas} bloqueada(s)`} />
            <Metrica rotulo="Advogados ativos" valor={m.advogados_ativos} detalhe="com monitoramento ativo" cor="text-ok" />
            <Metrica rotulo="Monitoramentos ativos" valor={m.monitoramentos_ativos} />
            <Metrica rotulo="Prazos capturados" valor={m.prazos_total} />
            <Metrica rotulo="Prazos em aberto" valor={m.prazos_abertos} cor="text-primary" />
            <Metrica rotulo="Vencidos sem cumprir" valor={m.prazos_vencidos} cor="text-danger" />
            <Metrica rotulo="Para conferir" valor={m.prazos_conferir} />
            <Metrica
              rotulo="Execuções em 24h"
              valor={m.execucoes_24h}
              detalhe={`${m.falhas_24h} falha(s)`}
              cor={m.falhas_24h > 0 ? 'text-danger' : 'text-ok'}
            />
          </div>
        )
      )}

      {m && (
        <p className="text-sm text-muted">
          Última execução do robô:{' '}
          {m.ultima_execucao ? (
            <>
              {formatarDataHora(m.ultima_execucao)} —{' '}
              {m.ultima_execucao_status === 'falha' ? <strong className="text-danger">falhou</strong> : 'ok'}
            </>
          ) : (
            'nenhuma ainda.'
          )}
        </p>
      )}

      <section className={cartao}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-xl font-bold text-navy">Últimas falhas</h2>
          <Link className="text-sm font-semibold text-primary underline underline-offset-2" to={rotaDev('execucoes')}>
            Ver todas as execuções
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className={tabela}>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Conta</th>
                <th>Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {execucoes.isSuccess && falhas.length === 0 && (
                <tr>
                  <td colSpan={3} className={vazioTabela}>
                    Nenhuma falha nas últimas execuções.
                  </td>
                </tr>
              )}
              {falhas.map((x) => (
                <tr key={x.id}>
                  <td className="whitespace-nowrap">{formatarDataHora(x.executado_em)}</td>
                  <td>{x.user_id ? (emailPorId.get(x.user_id) ?? x.user_id) : 'Geral (antes de identificar a conta)'}</td>
                  <td className="max-w-md text-xs break-words text-muted">{(x.detalhe ?? '').slice(0, 300)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
