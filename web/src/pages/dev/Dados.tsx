import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  alertaErro,
  botaoPequeno,
  botaoPrimario,
  campo,
  cartao,
  dica,
  rotulo,
  tabela,
  vazioTabela,
} from '../../components/ui'
import { useConfiguracaoDaConta, useContasAdmin } from '../../data/admin'
import { useExecucoes, useFeriados, useMonitoramentos, usePertencas, usePrazos } from '../../data/queries'
import { formatarData, formatarDataHora } from '../../domain/datas'
import { organizacaoAtiva } from '../../domain/organizacao'
import { ROTULO_STATUS } from '../../domain/selo'
import type { ContaAdmin } from '../../lib/database.types'
import { mensagemDeErro } from '../../lib/toast-context'
import { useEntrarComo } from './entrarComo'

const ABAS = [
  { aba: 'prazos', rotulo: 'Prazos' },
  { aba: 'monitoramentos', rotulo: 'Monitoramentos' },
  { aba: 'feriados', rotulo: 'Feriados' },
  { aba: 'configuracao', rotulo: 'Configuração' },
  { aba: 'execucoes', rotulo: 'Execuções' },
] as const

type Aba = (typeof ABAS)[number]['aba']

export default function Dados() {
  const contas = useContasAdmin()
  const [params, setParams] = useSearchParams()
  const advogados = (contas.data ?? []).filter((c) => c.app_role !== 'dev')
  const contaId = params.get('conta') ?? ''
  const conta = advogados.find((c) => c.id === contaId) ?? null

  return (
    <div className="space-y-5">
      <section className={`${cartao} p-5`}>
        <label className={rotulo} htmlFor="d-conta">
          Advogado
        </label>
        <select
          id="d-conta"
          className={`${campo} max-w-md`}
          value={conta?.id ?? ''}
          onChange={(e) => setParams(e.target.value ? { conta: e.target.value } : {})}
        >
          <option value="">Selecione uma conta…</option>
          {advogados.map((c) => (
            <option key={c.id} value={c.id}>
              {c.email}
            </option>
          ))}
        </select>
        <p className={dica}>
          Aqui é só leitura. Para editar, use <strong>Entrar como</strong>: você vê e altera tudo como o advogado,
          e cada alteração fica registrada na auditoria.
        </p>
        {contas.isError && (
          <div className={`${alertaErro} mt-3`}>Não foi possível carregar as contas: {mensagemDeErro(contas.error)}</div>
        )}
      </section>

      {conta && <DadosDaConta key={conta.id} conta={conta} />}
    </div>
  )
}

function DadosDaConta({ conta }: { conta: ContaAdmin }) {
  const [aba, setAba] = useState<Aba>('prazos')
  const entrarComo = useEntrarComo()
  const pertencas = usePertencas(conta.id)
  const orgId = organizacaoAtiva(pertencas.data ?? [])?.organizacao_id

  return (
    <section className={cartao}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dados exibidos">
          {ABAS.map((a) => (
            <button
              key={a.aba}
              type="button"
              aria-pressed={aba === a.aba}
              className={aba === a.aba ? `${botaoPrimario} ds-btn-sm` : botaoPequeno}
              onClick={() => setAba(a.aba)}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
        <button type="button" className={botaoPequeno} onClick={() => void entrarComo(conta)}>
          Entrar como para editar
        </button>
      </div>
      {aba === 'configuracao' && <Configuracao userId={conta.id} />}
      {aba !== 'configuracao' && pertencas.isPending && (
        <div className="space-y-2.5 p-5">
          <span className="sr-only">Carregando…</span>
          <div className="ds-skeleton h-4 w-1/2" />
        </div>
      )}
      {aba !== 'configuracao' && pertencas.isError && <Erro erro={pertencas.error} />}
      {aba !== 'configuracao' && pertencas.isSuccess && !orgId && (
        <p className="p-5 text-muted">Esta conta não pertence a nenhuma organização.</p>
      )}
      {orgId && aba === 'prazos' && <Prazos orgId={orgId} />}
      {orgId && aba === 'monitoramentos' && <Monitoramentos orgId={orgId} />}
      {orgId && aba === 'feriados' && <Feriados orgId={orgId} />}
      {orgId && aba === 'execucoes' && <Execucoes orgId={orgId} />}
    </section>
  )
}

function Carregando({ colunas }: { colunas: number }) {
  return (
    <tr>
      <td colSpan={colunas} className="space-y-2.5 py-5">
        <span className="sr-only">Carregando…</span>
        <div className="ds-skeleton h-4 w-3/4" />
        <div className="ds-skeleton h-4 w-1/2" />
      </td>
    </tr>
  )
}

function Vazio({ colunas, texto }: { colunas: number; texto: string }) {
  return (
    <tr>
      <td colSpan={colunas} className={vazioTabela}>
        {texto}
      </td>
    </tr>
  )
}

function Erro({ erro }: { erro: unknown }) {
  return <div className={`${alertaErro} m-3.5`}>Não foi possível carregar: {mensagemDeErro(erro)}</div>
}

function Prazos({ orgId }: { orgId: string }) {
  const prazos = usePrazos(orgId)
  const lista = prazos.data ?? []
  return (
    <div className="overflow-x-auto">
      {prazos.isError && <Erro erro={prazos.error} />}
      <table className={tabela}>
        <thead>
          <tr>
            <th>Vencimento</th>
            <th>Processo</th>
            <th>Tribunal</th>
            <th>Tipo</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {prazos.isPending && <Carregando colunas={5} />}
          {prazos.isSuccess && lista.length === 0 && <Vazio colunas={5} texto="Nenhum prazo." />}
          {lista.map((p) => (
            <tr key={p.id}>
              <td className="whitespace-nowrap">{formatarData(p.vencimento)}</td>
              <td data-label="Processo" className="font-mono text-[13px]">{p.processo ?? '—'}</td>
              <td data-label="Tribunal">{p.tribunal ?? '—'}</td>
              <td data-label="Tipo">{p.tipo ?? '—'}</td>
              <td data-label="Status">{ROTULO_STATUS[p.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Monitoramentos({ orgId }: { orgId: string }) {
  const monitoramentos = useMonitoramentos(orgId)
  const lista = monitoramentos.data ?? []
  return (
    <div className="overflow-x-auto">
      {monitoramentos.isError && <Erro erro={monitoramentos.error} />}
      <table className={tabela}>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Alvo</th>
            <th>Descrição</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>
          {monitoramentos.isPending && <Carregando colunas={4} />}
          {monitoramentos.isSuccess && lista.length === 0 && <Vazio colunas={4} texto="Nenhum monitoramento." />}
          {lista.map((m) => (
            <tr key={m.id}>
              <td data-label="Tipo">{m.tipo === 'oab' ? 'OAB' : 'Processo'}</td>
              <td data-titulo className="font-mono text-[13px]">
                {m.tipo === 'oab' ? `${m.oab_numero ?? ''}/${m.oab_uf ?? ''}` : (m.numero_processo ?? '—')}
              </td>
              <td data-label="Descrição">{m.descricao || '—'}</td>
              <td data-label="Situação">
                {m.ativo ? (
                  <span className="ds-badge ds-badge-success">Ativo</span>
                ) : (
                  <span className="ds-badge ds-badge-secondary">Pausado</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Feriados({ orgId }: { orgId: string }) {
  const feriados = useFeriados(orgId)
  const lista = feriados.data ?? []
  return (
    <div className="overflow-x-auto">
      {feriados.isError && <Erro erro={feriados.error} />}
      <table className={tabela}>
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
          </tr>
        </thead>
        <tbody>
          {feriados.isPending && <Carregando colunas={2} />}
          {feriados.isSuccess && lista.length === 0 && <Vazio colunas={2} texto="Nenhum feriado local." />}
          {lista.map((f) => (
            <tr key={f.data}>
              <td className="whitespace-nowrap">{formatarData(f.data)}</td>
              <td data-label="Descrição">{f.descricao}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Configuracao({ userId }: { userId: string }) {
  const config = useConfiguracaoDaConta(userId)
  if (config.isPending) {
    return (
      <div className="space-y-2.5 p-5">
        <span className="sr-only">Carregando…</span>
        <div className="ds-skeleton h-4 w-1/2" />
        <div className="ds-skeleton h-4 w-1/3" />
      </div>
    )
  }
  if (config.isError) return <Erro erro={config.error} />
  const c = config.data
  if (!c) return <p className="p-5 text-muted">Esta conta ainda não tem configuração (nunca entrou no site).</p>
  const linhas: [string, string][] = [
    ['E-mail para alertas', c.email_destino || '—'],
    ['Janela de alerta', `${c.dias_alerta} dias`],
    ['Resumo diário', c.resumo_escopo === 'meus' ? 'Só os prazos da pessoa' : c.resumo_escopo === 'todos' ? 'Todos os prazos' : 'Padrão do papel'],
    ['Atualizada em', formatarDataHora(c.updated_at)],
  ]
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 p-5 sm:grid-cols-[auto_minmax(0,1fr)]">
      {linhas.map(([titulo, valor]) => (
        <div key={titulo} className="contents">
          <dt className="text-sm font-semibold text-muted">{titulo}</dt>
          <dd className="break-all">{valor}</dd>
        </div>
      ))}
    </dl>
  )
}

function Execucoes({ orgId }: { orgId: string }) {
  const execucoes = useExecucoes(orgId)
  const lista = execucoes.data ?? []
  return (
    <div className="overflow-x-auto">
      {execucoes.isError && <Erro erro={execucoes.error} />}
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
          {execucoes.isPending && <Carregando colunas={6} />}
          {execucoes.isSuccess && lista.length === 0 && <Vazio colunas={6} texto="Nenhuma execução." />}
          {lista.map((x) => (
            <tr key={x.id}>
              <td className="whitespace-nowrap">{formatarDataHora(x.executado_em)}</td>
              <td data-label="Origem">{x.origem ?? '—'}</td>
              <td data-label="Encontradas">{x.encontradas}</td>
              <td data-label="Novas">{x.novas}</td>
              <td data-label="Status">
                {x.status === 'ok' ? (
                  <span className="ds-badge ds-badge-success">OK</span>
                ) : (
                  <span className="ds-badge ds-badge-destructive">Falha</span>
                )}
              </td>
              <td data-label="Detalhe" className="max-w-md text-xs break-words text-muted">
                {(x.detalhe ?? '').slice(0, 300)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
