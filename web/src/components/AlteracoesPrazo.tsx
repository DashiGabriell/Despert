import { useMemo } from 'react'
import { useAlteracoesDoPrazo } from '../data/queries'
import { autorDaAlteracao, descreverAlteracao } from '../domain/auditoria'
import { formatarDataHora } from '../domain/datas'
import type { MembroDaEquipe } from '../lib/database.types'
import { mensagemDeErro } from '../lib/toast-context'
import { alertaErro, separador } from './ui'

/** Quem cumpriu, mudou vencimento ou responsável (planos com auditoria). */
export default function AlteracoesPrazo({
  prazoId,
  membros,
}: {
  prazoId: string
  membros: readonly MembroDaEquipe[]
}) {
  const alteracoes = useAlteracoesDoPrazo(prazoId)
  const nomes = useMemo(() => new Map(membros.map((m) => [m.user_id, m.email])), [membros])

  return (
    <section aria-label="Alterações do prazo" className="mt-5">
      <div className={separador}>Alterações</div>
      {alteracoes.isPending && <p className="text-sm text-muted">Carregando…</p>}
      {alteracoes.isError && (
        <div className={alertaErro}>Não foi possível carregar as alterações: {mensagemDeErro(alteracoes.error)}</div>
      )}
      {alteracoes.isSuccess && alteracoes.data.length === 0 && (
        <p className="text-sm text-muted">Nenhuma alteração feita pela equipe neste prazo.</p>
      )}
      {alteracoes.isSuccess && alteracoes.data.length > 0 && (
        <ul className="space-y-1.5 text-sm">
          {alteracoes.data.map((a, i) => (
            <li key={`${a.criado_em}-${i}`}>
              <span className="text-muted">{formatarDataHora(a.criado_em)}</span> ·{' '}
              <strong className="font-semibold">{autorDaAlteracao(a)}</strong> — {descreverAlteracao(a, nomes)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
