import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { alertaErro, botaoPequeno, campo, cartao, tabela, vazioTabela } from '../components/ui'
import { usePlano } from '../data/plano'
import { useAuditoriaDaOrganizacao, useExportarAuditoria, useMembros } from '../data/queries'
import { useHoje } from '../data/relogio'
import { descreverAcao } from '../domain/acesso'
import {
  AUTOR_SUPORTE,
  CATEGORIAS_AUDITORIA,
  csvDaAuditoria,
  descreverRegistro,
  filtrarAuditoria,
  intervaloDoPeriodo,
  nomeDoArquivo,
  rotuloDoAutor,
  type CategoriaAuditoria,
} from '../domain/auditoria'
import { formatarDataHora, somarDias } from '../domain/datas'
import { baixarArquivo } from '../lib/download'
import { useOrganizacaoId, usePode } from '../lib/organizacao-context'
import { mensagemDeErro, useToast } from '../lib/toast-context'

export default function Auditoria() {
  const permite = usePode()
  const { limites } = usePlano()
  if (!permite('ver_auditoria') || !limites.auditoria) return <Navigate to="/prazos" replace />
  return <TelaAuditoria />
}

function TelaAuditoria() {
  const orgId = useOrganizacaoId()
  const hoje = useHoje()
  const avisar = useToast()
  const membros = useMembros(orgId)
  const [de, setDe] = useState(() => somarDias(hoje, -30))
  const [ate, setAte] = useState(hoje)
  const [autor, setAutor] = useState('')
  const [categoria, setCategoria] = useState<CategoriaAuditoria | ''>('')
  const periodo = intervaloDoPeriodo(de, ate)
  const registros = useAuditoriaDaOrganizacao(orgId, periodo)
  const exportar = useExportarAuditoria(orgId)

  const nomes = useMemo(
    () => new Map((membros.data ?? []).map((m) => [m.user_id, m.email])),
    [membros.data],
  )
  const autores = useMemo(() => {
    const lista = new Map(nomes)
    for (const r of registros.data ?? []) {
      if (r.membro_id && !lista.has(r.membro_id)) lista.set(r.membro_id, rotuloDoAutor(r))
    }
    return [...lista].sort((a, b) => a[1].localeCompare(b[1]))
  }, [nomes, registros.data])

  const filtro = { autor, categoria }
  const lista = filtrarAuditoria(registros.data ?? [], filtro)
  const periodoInvalido = Boolean(de && ate && de > ate)

  function exportarCsv() {
    exportar.mutate(periodo, {
      onSuccess: (dados) => {
        baixarArquivo(nomeDoArquivo('auditoria', hoje), csvDaAuditoria(filtrarAuditoria(dados, filtro), nomes))
        avisar('Auditoria exportada.', 'ok')
      },
      onError: (erro) => avisar(`Não foi possível exportar: ${mensagemDeErro(erro)}`, 'erro'),
    })
  }

  return (
    <section className={cartao}>
      <div className="flex flex-wrap items-end gap-2.5 border-b border-line p-3.5">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">De</span>
          <input type="date" aria-label="De" className={campo} value={de} max={ate || undefined} onChange={(e) => setDe(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">Até</span>
          <input type="date" aria-label="Até" className={campo} value={ate} min={de || undefined} onChange={(e) => setAte(e.target.value)} />
        </label>
        <select aria-label="Filtrar por autor" className={`${campo} max-w-56`} value={autor} onChange={(e) => setAutor(e.target.value)}>
          <option value="">Todos os autores</option>
          {autores.map(([id, email]) => (
            <option key={id} value={id}>
              {email}
            </option>
          ))}
          <option value={AUTOR_SUPORTE}>Suporte Despert</option>
        </select>
        <select
          aria-label="Filtrar por tipo"
          className={`${campo} max-w-48`}
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as CategoriaAuditoria | '')}
        >
          <option value="">Todos os tipos</option>
          {CATEGORIAS_AUDITORIA.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.rotulo}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`${botaoPequeno} ml-auto`}
          disabled={exportar.isPending || periodoInvalido}
          onClick={exportarCsv}
        >
          {exportar.isPending ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </div>
      <p className="border-b border-line px-4 py-2.5 text-sm text-muted">
        Alterações feitas pela equipe e pelo suporte do Despert nesta organização (até 500 registros por período).
      </p>
      {periodoInvalido && <div className={`${alertaErro} m-3.5`}>A data inicial é depois da final.</div>}
      {registros.isError && (
        <div className={`${alertaErro} m-3.5`}>Não foi possível carregar: {mensagemDeErro(registros.error)}</div>
      )}
      <div className="overflow-x-auto">
        <table className={tabela}>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Autor</th>
              <th>Ação</th>
              <th>Alterações</th>
            </tr>
          </thead>
          <tbody>
            {registros.isPending && (
              <tr>
                <td colSpan={4} className="space-y-2.5 py-5">
                  <span className="sr-only">Carregando…</span>
                  <div className="ds-skeleton h-4 w-3/4" />
                  <div className="ds-skeleton h-4 w-1/2" />
                </td>
              </tr>
            )}
            {registros.isSuccess && lista.length === 0 && (
              <tr>
                <td colSpan={4} className={vazioTabela}>
                  Nenhum registro nesse período com esses filtros.
                </td>
              </tr>
            )}
            {lista.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">{formatarDataHora(r.criado_em)}</td>
                <td data-label="Autor" className="break-all">{rotuloDoAutor(r)}</td>
                <td data-label="Ação">{descreverAcao(r.acao)}</td>
                <td data-label="Alterações" className="text-xs text-muted">{descreverRegistro(r, nomes) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
