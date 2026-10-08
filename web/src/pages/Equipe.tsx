import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import {
  alertaAviso,
  alertaErro,
  alertaOk,
  botaoPequeno,
  botaoPerigoPequeno,
  botaoPrimario,
  campo,
  cartao,
  dica,
  rotulo,
  tabela,
  vazioTabela,
} from '../components/ui'
import { usePlano } from '../data/plano'
import {
  useAlterarPapel,
  useCancelarConvite,
  useConvidar,
  useConvites,
  useMembros,
  useReenviarConvite,
  useRemoverMembro,
} from '../data/queries'
import { useAgora } from '../data/relogio'
import { formatarDataHora } from '../domain/datas'
import {
  convitesEmAberto,
  DESCRICAO_PAPEL,
  linkDoConvite,
  mailtoDoConvite,
  nomeDoMembro,
  ROTULO_PAPEL,
  situacaoDoConvite,
  vagasLivres,
} from '../domain/equipe'
import { PAPEIS } from '../domain/permissoes'
import { validarConvite } from '../domain/validacao'
import { useUserId } from '../lib/auth-context'
import type { Convite, PapelMembro } from '../lib/database.types'
import { useOrganizacaoId, usePertenca, usePode } from '../lib/organizacao-context'
import { mensagemDeErro, useToast } from '../lib/toast-context'

/** Equipe da organização (#18): só o Administrador, e só em planos com papéis. */
export default function Equipe() {
  const permite = usePode()
  const { limites } = usePlano()
  if (!permite('gerenciar_equipe') || !limites.papeis) return <Navigate to="/prazos" replace />
  return <TelaEquipe />
}

function AcoesDoLink({ convite, organizacao }: { convite: Convite; organizacao: string }) {
  const avisar = useToast()
  const link = linkDoConvite(window.location.origin, convite.token)
  return (
    <>
      <button
        type="button"
        className={botaoPequeno}
        onClick={() => {
          void navigator.clipboard?.writeText(link).then(
            () => avisar('Link do convite copiado.', 'ok'),
            () => avisar(`Não foi possível copiar. Link: ${link}`, 'erro'),
          )
        }}
      >
        Copiar link
      </button>
      <a
        className={botaoPequeno}
        href={mailtoDoConvite({ email: convite.email, organizacao, papel: convite.papel, link })}
      >
        Enviar por e-mail
      </a>
    </>
  )
}

function TelaEquipe() {
  const orgId = useOrganizacaoId()
  const eu = useUserId()
  const { organizacao } = usePertenca()
  const { limites, escrita } = usePlano()
  const avisar = useToast()
  const agora = useAgora(60_000)
  const membros = useMembros(orgId)
  const convites = useConvites(orgId)
  const convidar = useConvidar(orgId)
  const reenviar = useReenviarConvite(orgId)
  const cancelar = useCancelarConvite(orgId)
  const alterarPapel = useAlterarPapel(orgId)
  const remover = useRemoverMembro(orgId)

  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState<PapelMembro>('advogado')
  const [erro, setErro] = useState<string | null>(null)
  const [criado, setCriado] = useState<Convite | null>(null)

  const equipe = membros.data ?? []
  const emAberto = convitesEmAberto(convites.data ?? [])
  const livres = vagasLivres(limites.usuarios, equipe.length, emAberto, agora)
  const ocupadas = limites.usuarios - livres

  function enviar(e: FormEvent) {
    e.preventDefault()
    const resultado = validarConvite(
      { email, papel },
      equipe.map((m) => m.email),
      emAberto.filter((c) => situacaoDoConvite(c, agora) === 'pendente').map((c) => c.email),
    )
    if (!resultado.ok) {
      setErro(resultado.erro)
      return
    }
    setErro(null)
    setCriado(null)
    convidar.mutate(resultado.valor, {
      onSuccess: (convite) => {
        setEmail('')
        setCriado(convite)
      },
      onError: (falha) => setErro(mensagemDeErro(falha)),
    })
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section className={`${cartao} p-5`}>
        <h2 className="mb-1 text-2xl font-bold text-navy">Convidar para a equipe</h2>
        <p className="mb-4 text-sm text-muted">
          Vagas do plano: <strong className="text-ink">{ocupadas} de {limites.usuarios}</strong> (membros e convites
          pendentes).
        </p>
        {!escrita && (
          <div className={`${alertaAviso} mb-4`}>Organização em modo somente leitura: a equipe não pode ser alterada.</div>
        )}
        {escrita && livres === 0 && (
          <div className={`${alertaAviso} mb-4`}>
            Todas as vagas do plano estão ocupadas. Cancele um convite pendente, remova alguém da equipe ou fale com o
            suporte para ampliar o plano.
          </div>
        )}
        <form onSubmit={enviar} noValidate className="space-y-3.5">
          <div>
            <label className={rotulo} htmlFor="q-email">
              E-mail
            </label>
            <input
              id="q-email"
              type="email"
              className={campo}
              placeholder="pessoa@escritorio.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className={rotulo} htmlFor="q-papel">
              Papel
            </label>
            <select id="q-papel" className={campo} value={papel} onChange={(e) => setPapel(e.target.value as PapelMembro)}>
              {PAPEIS.map((p) => (
                <option key={p} value={p}>
                  {ROTULO_PAPEL[p]}
                </option>
              ))}
            </select>
            <p className={dica}>{DESCRICAO_PAPEL[papel]}</p>
          </div>
          {erro && (
            <div role="alert" className={alertaErro}>
              {erro}
            </div>
          )}
          <button type="submit" className={botaoPrimario} disabled={convidar.isPending || !escrita || livres === 0}>
            Criar convite
          </button>
        </form>
        {criado && (
          <div className={`${alertaOk} mt-4 space-y-2`}>
            <p>
              Convite criado para <strong>{criado.email}</strong>. O e-mail com o link sai em alguns minutos; se
              preferir, envie o link você mesmo. A pessoa entra (ou cria a conta na hora) com esse e-mail. Vale por 7
              dias.
            </p>
            <div className="flex flex-wrap gap-2">
              <AcoesDoLink convite={criado} organizacao={organizacao.nome} />
            </div>
          </div>
        )}
      </section>

      <div className="space-y-5">
        <section className={cartao}>
          <h2 className="border-b border-line px-5 py-4 text-2xl font-bold text-navy">Membros</h2>
          {membros.isError && (
            <div className={`${alertaErro} m-3.5`}>Não foi possível carregar: {mensagemDeErro(membros.error)}</div>
          )}
          <div className="overflow-x-auto">
            <table className={tabela}>
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Papel</th>
                  <th>Desde</th>
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {membros.isPending && (
                  <tr>
                    <td colSpan={4} className="py-5">
                      <span className="sr-only">Carregando…</span>
                      <div className="ds-skeleton h-4 w-2/3" />
                    </td>
                  </tr>
                )}
                {equipe.map((m) => {
                  const souEu = m.user_id === eu
                  return (
                    <tr key={m.user_id}>
                      <td>
                        <strong>{nomeDoMembro(m, eu)}</strong>
                        <div className="text-xs text-muted">{m.email}</div>
                      </td>
                      <td data-label="Papel">
                        {souEu ? (
                          ROTULO_PAPEL[m.papel]
                        ) : (
                          <select
                            aria-label={`Papel de ${m.email}`}
                            className={`${campo} py-1.5 text-sm`}
                            value={m.papel}
                            disabled={!escrita || alterarPapel.isPending}
                            onChange={(e) => {
                              const novo = e.target.value as PapelMembro
                              const pausa =
                                (m.papel === 'administrador' || m.papel === 'advogado') &&
                                (novo === 'assistente' || novo === 'leitura')
                              if (
                                pausa &&
                                !window.confirm(
                                  `Mudar ${m.email} para ${ROTULO_PAPEL[novo]}? A OAB monitorada dessa pessoa será pausada.`,
                                )
                              ) {
                                return
                              }
                              alterarPapel.mutate(
                                { membro: m.user_id, papel: novo },
                                {
                                  onSuccess: () => avisar('Papel alterado.', 'ok'),
                                  onError: (falha) => avisar(mensagemDeErro(falha), 'erro'),
                                },
                              )
                            }}
                          >
                            {PAPEIS.map((p) => (
                              <option key={p} value={p}>
                                {ROTULO_PAPEL[p]}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td data-label="Desde" className="whitespace-nowrap">{formatarDataHora(m.criado_em)}</td>
                      <td className="text-right">
                        {!souEu && (
                          <button
                            type="button"
                            className={botaoPerigoPequeno}
                            disabled={!escrita || remover.isPending}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Remover ${m.email} da equipe? A OAB dessa pessoa deixa de ser monitorada, os prazos continuam na organização e os que estão em aberto passam para você.`,
                                )
                              ) {
                                return
                              }
                              remover.mutate(m.user_id, {
                                onSuccess: () => avisar('Pessoa removida da equipe.'),
                                onError: (falha) => avisar(mensagemDeErro(falha), 'erro'),
                              })
                            }}
                          >
                            Remover
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className={cartao}>
          <h2 className="border-b border-line px-5 py-4 text-2xl font-bold text-navy">Convites</h2>
          {convites.isError && (
            <div className={`${alertaErro} m-3.5`}>Não foi possível carregar: {mensagemDeErro(convites.error)}</div>
          )}
          <div className="overflow-x-auto">
            <table className={tabela}>
              <thead>
                <tr>
                  <th>E-mail</th>
                  <th>Papel</th>
                  <th>Situação</th>
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {convites.isSuccess && emAberto.length === 0 && (
                  <tr>
                    <td colSpan={4} className={vazioTabela}>
                      Nenhum convite pendente.
                    </td>
                  </tr>
                )}
                {emAberto.map((c) => {
                  const expirado = situacaoDoConvite(c, agora) === 'expirado'
                  return (
                    <tr key={c.id} className={expirado ? '[&>td]:text-muted' : ''}>
                      <td>{c.email}</td>
                      <td data-label="Papel">{ROTULO_PAPEL[c.papel]}</td>
                      <td data-label="Situação" className="whitespace-nowrap">
                        {expirado ? 'Expirado' : `Vale até ${formatarDataHora(c.expira_em)}`}
                        {!expirado && (
                          <span className="block text-sm text-muted">
                            {c.enviado_em ? `E-mail enviado em ${formatarDataHora(c.enviado_em)}` : 'E-mail na fila'}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {!expirado && <AcoesDoLink convite={c} organizacao={organizacao.nome} />}
                          <button
                            type="button"
                            className={botaoPequeno}
                            disabled={!escrita || reenviar.isPending}
                            onClick={() =>
                              reenviar.mutate(c.id, {
                                onSuccess: () =>
                                  avisar('Convite renovado por mais 7 dias. O e-mail sai de novo em alguns minutos.', 'ok'),
                                onError: (falha) => avisar(mensagemDeErro(falha), 'erro'),
                              })
                            }
                          >
                            Reenviar
                          </button>
                          <button
                            type="button"
                            className={botaoPerigoPequeno}
                            disabled={cancelar.isPending}
                            onClick={() =>
                              cancelar.mutate(c.id, {
                                onSuccess: () => avisar('Convite cancelado.'),
                                onError: (falha) => avisar(mensagemDeErro(falha), 'erro'),
                              })
                            }
                          >
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
