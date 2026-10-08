import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Modal from '../../components/Modal'
import {
  alertaErro,
  botao,
  botaoPequeno,
  botaoPerigo,
  botaoPerigoForte,
  botaoPrimario,
  campo,
  cartao,
  dica,
  rotulo,
  separador,
  tabela,
  vazioTabela,
} from '../../components/ui'
import { useAcaoAdmin, useContasAdmin, useGerarTokenAdvogado } from '../../data/admin'
import { filtrarContas, rotaDev } from '../../domain/acesso'
import { formatarDataHora } from '../../domain/datas'
import { novoToken } from '../../domain/token'
import { validarNovaConta, validarNovaSenha, type FormNovaConta } from '../../domain/validacao'
import { useAuth } from '../../lib/auth-context'
import type { ContaAdmin } from '../../lib/database.types'
import { mensagemDeErro, useToast } from '../../lib/toast-context'
import { useEntrarComo } from './entrarComo'

export default function Usuarios() {
  const contas = useContasAdmin()
  const entrarComo = useEntrarComo()
  const [busca, setBusca] = useState('')
  const [gerenciandoId, setGerenciandoId] = useState<string | null>(null)
  const lista = filtrarContas(contas.data ?? [], busca)
  const gerenciando = contas.data?.find((c) => c.id === gerenciandoId) ?? null

  return (
    <div className="space-y-5">
      <NovaConta emailsExistentes={(contas.data ?? []).map((c) => c.email)} />

      <section className={cartao}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-xl font-bold text-navy">Contas ({contas.data?.length ?? 0})</h2>
          <label className="w-full max-w-xs">
            <span className="sr-only">Buscar por e-mail</span>
            <input
              type="search"
              className={campo}
              placeholder="Buscar por e-mail"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
        </div>
        {contas.isError && (
          <div className={`${alertaErro} m-3.5`}>Não foi possível carregar as contas: {mensagemDeErro(contas.error)}</div>
        )}
        <div className="overflow-x-auto">
          <table className={tabela}>
            <thead>
              <tr>
                <th>E-mail</th>
                <th>Criada em</th>
                <th>Último acesso</th>
                <th>Monitoramentos</th>
                <th>Prazos abertos</th>
                <th>Última execução</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {contas.isPending && (
                <tr>
                  <td colSpan={7} className="space-y-2.5 py-5">
                    <span className="sr-only">Carregando…</span>
                    <div className="ds-skeleton h-4 w-3/4" />
                    <div className="ds-skeleton h-4 w-1/2" />
                  </td>
                </tr>
              )}
              {contas.isSuccess && lista.length === 0 && (
                <tr>
                  <td colSpan={7} className={vazioTabela}>
                    {busca ? 'Nenhuma conta com esse e-mail.' : 'Nenhuma conta cadastrada.'}
                  </td>
                </tr>
              )}
              {lista.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="font-semibold break-all">{c.email}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.app_role === 'dev' && <span className="ds-badge ds-badge-navy">dev</span>}
                      {c.bloqueado && <span className="ds-badge ds-badge-destructive">bloqueada</span>}
                      {!c.confirmado && <span className="ds-badge ds-badge-warning">e-mail não confirmado</span>}
                    </div>
                  </td>
                  <td data-label="Criada em" className="whitespace-nowrap">
                    {formatarDataHora(c.criado_em)}
                  </td>
                  <td data-label="Último acesso" className="whitespace-nowrap">
                    {c.ultimo_acesso ? formatarDataHora(c.ultimo_acesso) : '—'}
                  </td>
                  <td data-label="Monitoramentos">{c.monitoramentos_ativos}</td>
                  <td data-label="Prazos abertos">
                    {c.prazos_abertos}
                    {c.prazos_vencidos > 0 && (
                      <span className="ml-1.5 text-xs font-semibold text-danger">({c.prazos_vencidos} vencidos)</span>
                    )}
                  </td>
                  <td data-label="Última execução" className="whitespace-nowrap">
                    {c.ultima_execucao ? (
                      <>
                        {formatarDataHora(c.ultima_execucao)}{' '}
                        {c.ultima_execucao_status === 'falha' && (
                          <span className="ds-badge ds-badge-destructive">Falha</span>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      {c.app_role !== 'dev' && (
                        <>
                          <Link className={botaoPequeno} to={`${rotaDev('dados')}?conta=${c.id}`}>
                            Ver dados
                          </Link>
                          <button type="button" className={botaoPequeno} onClick={() => void entrarComo(c)}>
                            Entrar como
                          </button>
                        </>
                      )}
                      <button type="button" className={botaoPequeno} onClick={() => setGerenciandoId(c.id)}>
                        Gerenciar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {gerenciando && <GerenciarConta conta={gerenciando} onFechar={() => setGerenciandoId(null)} />}
    </div>
  )
}

function NovaConta({ emailsExistentes }: { emailsExistentes: string[] }) {
  const avisar = useToast()
  const acao = useAcaoAdmin()
  const [form, setForm] = useState<FormNovaConta>({ email: '', senha: '', papel: 'advogado' })
  const [erro, setErro] = useState<string | null>(null)

  function enviar(e: FormEvent) {
    e.preventDefault()
    const resultado = validarNovaConta(form, emailsExistentes)
    if (!resultado.ok) {
      setErro(resultado.erro)
      return
    }
    setErro(null)
    acao.mutate(
      { acao: 'criar_conta', ...resultado.valor },
      {
        onSuccess: () => {
          setForm({ email: '', senha: '', papel: 'advogado' })
          avisar(`Conta ${resultado.valor.email} criada. Passe a senha para a pessoa por um canal seguro.`, 'ok')
        },
        onError: (falha) => setErro(`Não foi possível criar: ${mensagemDeErro(falha)}`),
      },
    )
  }

  return (
    <section className={`${cartao} p-5`}>
      <h2 className="mb-1 text-xl font-bold text-navy">Nova conta</h2>
      <p className={`${dica} mb-4`}>A conta já nasce confirmada; a pessoa entra com o e-mail e a senha definidos aqui.</p>
      <form
        onSubmit={enviar}
        noValidate
        className="grid grid-cols-1 items-end gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto_auto]"
      >
        <div>
          <label className={rotulo} htmlFor="n-email">
            E-mail
          </label>
          <input
            id="n-email"
            type="email"
            autoComplete="off"
            className={campo}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className={rotulo} htmlFor="n-senha">
            Senha inicial
          </label>
          <input
            id="n-senha"
            type="text"
            autoComplete="off"
            className={campo}
            value={form.senha}
            onChange={(e) => setForm({ ...form, senha: e.target.value })}
          />
        </div>
        <div>
          <label className={rotulo} htmlFor="n-papel">
            Papel
          </label>
          <select
            id="n-papel"
            className={campo}
            value={form.papel}
            onChange={(e) => setForm({ ...form, papel: e.target.value === 'dev' ? 'dev' : 'advogado' })}
          >
            <option value="advogado">Advogado</option>
            <option value="dev">Dev</option>
          </select>
        </div>
        <button type="submit" className={botaoPrimario} disabled={acao.isPending}>
          {acao.isPending ? 'Criando…' : 'Criar conta'}
        </button>
      </form>
      {erro && <div className={`${alertaErro} mt-3`}>{erro}</div>}
    </section>
  )
}

function GerenciarConta({ conta, onFechar }: { conta: ContaAdmin; onFechar: () => void }) {
  const avisar = useToast()
  const { sessao } = useAuth()
  const acao = useAcaoAdmin()
  const gerarToken = useGerarTokenAdvogado()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const ehVoce = conta.id === sessao?.user.id
  const ehDev = conta.app_role === 'dev'
  const ocupado = acao.isPending || gerarToken.isPending

  function falhou(falha: unknown) {
    setErro(mensagemDeErro(falha))
  }

  function redefinirSenha(e: FormEvent) {
    e.preventDefault()
    const resultado = validarNovaSenha(senha)
    if (!resultado.ok) {
      setErro(resultado.erro)
      return
    }
    setErro(null)
    acao.mutate(
      { acao: 'redefinir_senha', user_id: conta.id, senha: resultado.valor },
      {
        onSuccess: () => {
          setSenha('')
          avisar('Senha redefinida.', 'ok')
        },
        onError: falhou,
      },
    )
  }

  function alternarPapel() {
    setErro(null)
    acao.mutate(
      { acao: 'definir_papel', user_id: conta.id, papel: ehDev ? 'advogado' : 'dev' },
      {
        onSuccess: () =>
          avisar(
            ehDev ? 'Acesso dev removido.' : 'Conta promovida a dev. Vale no próximo carregamento do site.',
            'ok',
          ),
        onError: falhou,
      },
    )
  }

  function alternarBloqueio() {
    setErro(null)
    acao.mutate(
      { acao: conta.bloqueado ? 'desbloquear' : 'bloquear', user_id: conta.id },
      {
        onSuccess: () => avisar(conta.bloqueado ? 'Conta desbloqueada.' : 'Conta bloqueada.', 'ok'),
        onError: falhou,
      },
    )
  }

  function trocarToken() {
    setErro(null)
    gerarToken.mutate(
      { userId: conta.id, token: novoToken() },
      { onSuccess: () => avisar('Novo token gerado; o anterior parou de funcionar.', 'ok'), onError: falhou },
    )
  }

  function excluir() {
    setErro(null)
    acao.mutate(
      { acao: 'excluir_conta', user_id: conta.id },
      {
        onSuccess: () => {
          avisar(`Conta ${conta.email} excluída com todos os dados.`, 'ok')
          onFechar()
        },
        onError: falhou,
      },
    )
  }

  return (
    <Modal
      titulo="Gerenciar conta"
      subtitulo={
        <>
          <span className="break-all">{conta.email}</span>
          {ehDev && <span className="ds-badge ds-badge-navy">dev</span>}
          {conta.bloqueado && <span className="ds-badge ds-badge-destructive">bloqueada</span>}
          {ehVoce && <span className="ds-badge ds-badge-secondary">você</span>}
        </>
      }
      onFechar={onFechar}
      rodape={
        <button type="button" className={botao} onClick={onFechar}>
          Fechar
        </button>
      }
    >
      <div className="space-y-5">
        {erro && <div className={alertaErro}>{erro}</div>}

        <form onSubmit={redefinirSenha} noValidate>
          <div className={separador}>Senha</div>
          <label className={rotulo} htmlFor="g-senha">
            Nova senha
          </label>
          <div className="flex gap-2">
            <input
              id="g-senha"
              type="text"
              autoComplete="off"
              className={campo}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
            <button type="submit" className={botaoPrimario} disabled={ocupado}>
              Redefinir
            </button>
          </div>
          <p className={dica}>Mínimo de 8 caracteres. Passe a nova senha por um canal seguro.</p>
        </form>

        <div>
          <div className={separador}>Papel</div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={botao} disabled={ocupado || ehVoce} onClick={alternarPapel}>
              {ehDev ? 'Remover acesso dev' : 'Promover a dev'}
            </button>
            <span className={dica}>
              {ehVoce
                ? 'Você não pode remover o seu próprio acesso dev.'
                : 'O dev controla toda a aplicação, inclusive o n8n. A mudança vale quando a pessoa recarregar o site.'}
            </span>
          </div>
        </div>

        {!ehDev && (
          <div>
            <div className={separador}>Token do Buscar agora</div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className={botao} disabled={ocupado} onClick={trocarToken}>
                Gerar novo token
              </button>
              <span className={dica}>Use se suspeitar que o token vazou; o anterior deixa de valer na hora.</span>
            </div>
          </div>
        )}

        <div>
          <div className={separador}>Acesso</div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={botaoPerigo} disabled={ocupado || ehVoce} onClick={alternarBloqueio}>
              {conta.bloqueado ? 'Desbloquear conta' : 'Bloquear conta'}
            </button>
            <span className={dica}>
              {ehVoce ? 'Você não pode bloquear a própria conta.' : 'Conta bloqueada não consegue entrar; os dados ficam guardados.'}
            </span>
          </div>
        </div>

        {!ehVoce && (
          <div className="rounded-lg border border-danger/40 bg-danger-soft p-4">
            <div className={`${separador} text-danger`}>Excluir conta</div>
            <p className="mb-2 text-sm">
              Apaga a conta e <strong>todos</strong> os prazos, monitoramentos, feriados e execuções dela. Não tem
              volta. Digite o e-mail para confirmar.
            </p>
            <div className="flex gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Digite o e-mail para confirmar</span>
                <input
                  className={campo}
                  placeholder={conta.email}
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                />
              </label>
              <button
                type="button"
                className={botaoPerigoForte}
                disabled={ocupado || confirmacao.trim().toLowerCase() !== conta.email.toLowerCase()}
                onClick={excluir}
              >
                Excluir
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
