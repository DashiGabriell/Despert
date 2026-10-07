import { useState, type FormEvent } from 'react'
import {
  alertaAviso,
  alertaErro,
  botaoPequeno,
  botaoPerigoPequeno,
  botaoPrimario,
  campo,
  cartao,
  dica,
  rotulo,
  separador,
  tabela,
  vazioTabela,
} from '../components/ui'
import { usePlano } from '../data/plano'
import {
  useConfiguracao,
  useConfiguracaoOrganizacao,
  useCriarFeriado,
  useFeriados,
  useMembros,
  useRemoverFeriado,
  useSalvarConfiguracao,
  useSalvarConfiguracaoOrganizacao,
} from '../data/queries'
import { formatarData } from '../domain/datas'
import { escopoDoResumo } from '../domain/equipe'
import { novoToken } from '../domain/token'
import {
  validarConfiguracaoOrganizacao,
  validarConfiguracaoPessoal,
  validarFeriado,
  type FormConfiguracaoOrganizacao,
  type FormConfiguracaoPessoal,
} from '../domain/validacao'
import { useEmailEfetivo, useUserId } from '../lib/auth-context'
import type { Configuracao, ConfiguracaoOrganizacao, PapelMembro } from '../lib/database.types'
import { useOrganizacaoId, usePertenca, usePode } from '../lib/organizacao-context'
import { mensagemDeErro, useToast } from '../lib/toast-context'

function Carregando() {
  return (
    <div className="space-y-3">
      <span className="sr-only">Carregando…</span>
      <div className="ds-skeleton h-10" />
      <div className="ds-skeleton h-10" />
      <div className="ds-skeleton h-10 w-2/3" />
    </div>
  )
}

export default function Configuracoes() {
  const userId = useUserId()
  const orgId = useOrganizacaoId()
  const email = useEmailEfetivo()
  const { papel } = usePertenca()
  const permite = usePode()
  const config = useConfiguracao(userId, email)
  const configOrganizacao = useConfiguracaoOrganizacao(orgId)
  const membros = useMembros(orgId)
  const equipe = (membros.data?.length ?? 0) > 1

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
      <div className="space-y-5">
        <section className={`${cartao} p-5`}>
          <h2 className="mb-4 text-2xl font-bold text-navy">Seus alertas</h2>
          {config.isPending && <Carregando />}
          {config.isError && (
            <div className={alertaErro}>Não foi possível carregar: {mensagemDeErro(config.error)}</div>
          )}
          {config.data && (
            <FormularioPessoal
              key={config.data.updated_at}
              userId={userId}
              papel={papel}
              equipe={equipe}
              config={config.data}
            />
          )}
        </section>

        <section className={`${cartao} p-5`}>
          <h2 className="mb-4 text-2xl font-bold text-navy">Robô da organização</h2>
          {configOrganizacao.isPending && <Carregando />}
          {configOrganizacao.isError && (
            <div className={alertaErro}>Não foi possível carregar: {mensagemDeErro(configOrganizacao.error)}</div>
          )}
          {configOrganizacao.data &&
            (permite('configurar_organizacao') ? (
              <FormularioOrganizacao
                key={configOrganizacao.data.updated_at}
                orgId={orgId}
                userId={userId}
                config={configOrganizacao.data}
              />
            ) : (
              <ResumoOrganizacao config={configOrganizacao.data} />
            ))}
        </section>
      </div>
      <Feriados orgId={orgId} podeAlterar={permite('configurar_organizacao')} />
    </div>
  )
}

function FormularioPessoal({
  userId,
  papel,
  equipe,
  config,
}: {
  userId: string
  papel: PapelMembro
  equipe: boolean
  config: Configuracao
}) {
  const avisar = useToast()
  const salvar = useSalvarConfiguracao(userId)
  const [form, setForm] = useState<FormConfiguracaoPessoal>({
    email_destino: config.email_destino,
    dias_alerta: String(config.dias_alerta),
    resumo_escopo: escopoDoResumo(papel, config.resumo_escopo),
  })
  const [erro, setErro] = useState<string | null>(null)

  function enviar(e: FormEvent) {
    e.preventDefault()
    const resultado = validarConfiguracaoPessoal(form)
    if (!resultado.ok) {
      setErro(resultado.erro)
      return
    }
    setErro(null)
    salvar.mutate(resultado.valor, {
      onSuccess: () => avisar('Configurações salvas.', 'ok'),
      onError: (falha) => setErro(`Não foi possível salvar: ${mensagemDeErro(falha)}`),
    })
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-3.5">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <label className={rotulo} htmlFor="c-email">
            E-mail para alertas
          </label>
          <input
            id="c-email"
            type="email"
            className={campo}
            value={form.email_destino}
            onChange={(e) => setForm({ ...form, email_destino: e.target.value })}
          />
        </div>
        <div>
          <label className={rotulo} htmlFor="c-alerta">
            Janela de alerta
          </label>
          <input
            id="c-alerta"
            type="number"
            min={1}
            max={60}
            className={campo}
            value={form.dias_alerta}
            onChange={(e) => setForm({ ...form, dias_alerta: e.target.value })}
          />
        </div>
      </div>
      <p className={`${dica} -mt-1.5`}>"Janela de alerta" define quantos dias à frente entram no resumo diário por e-mail.</p>
      {equipe && (
        <div>
          <label className={rotulo} htmlFor="c-escopo">
            Resumo diário
          </label>
          <select
            id="c-escopo"
            className={campo}
            value={form.resumo_escopo}
            onChange={(e) => setForm({ ...form, resumo_escopo: e.target.value as FormConfiguracaoPessoal['resumo_escopo'] })}
          >
            <option value="meus">Só os prazos sob minha responsabilidade</option>
            <option value="todos">Todos os prazos da organização</option>
          </select>
          <p className={dica}>
            Por enquanto o resumo chega a quem tem OAB monitorada, com os prazos dela; esta escolha passa a valer na
            próxima atualização do robô.
          </p>
        </div>
      )}
      {erro && <div className={alertaErro}>{erro}</div>}
      <button type="submit" className={botaoPrimario} disabled={salvar.isPending}>
        Salvar alertas
      </button>
    </form>
  )
}

function ResumoOrganizacao({ config }: { config: ConfiguracaoOrganizacao }) {
  return (
    <div className="space-y-2 text-sm">
      <p>
        Cada busca relê <strong>{config.dias_retroativos} dias</strong> do Diário; quando o texto não informa o
        prazo, usa <strong>{config.prazo_padrao_dias} dias</strong> (fica para conferir). Recesso forense{' '}
        <strong>{config.considerar_recesso ? 'considerado' : 'não considerado'}</strong>.
      </p>
      <p className={dica}>Só o Administrador da organização altera essas configurações.</p>
    </div>
  )
}

function FormularioOrganizacao({
  orgId,
  userId,
  config,
}: {
  orgId: string
  userId: string
  config: ConfiguracaoOrganizacao
}) {
  const avisar = useToast()
  const { escrita } = usePlano()
  const salvar = useSalvarConfiguracaoOrganizacao(orgId, userId)
  const [form, setForm] = useState<FormConfiguracaoOrganizacao>({
    dias_retroativos: String(config.dias_retroativos),
    prazo_padrao_dias: String(config.prazo_padrao_dias),
    considerar_recesso: config.considerar_recesso,
    webhook_token: config.webhook_token,
  })
  const [erro, setErro] = useState<string | null>(null)
  const tokenAlterado = form.webhook_token !== config.webhook_token

  function alterar<K extends keyof FormConfiguracaoOrganizacao>(chave: K, valor: FormConfiguracaoOrganizacao[K]) {
    setForm((atual) => ({ ...atual, [chave]: valor }))
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    const resultado = validarConfiguracaoOrganizacao(form)
    if (!resultado.ok) {
      setErro(resultado.erro)
      return
    }
    setErro(null)
    salvar.mutate(resultado.valor, {
      onSuccess: () => avisar('Configurações da organização salvas.', 'ok'),
      onError: (falha) => setErro(`Não foi possível salvar: ${mensagemDeErro(falha)}`),
    })
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-3.5">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div>
          <label className={rotulo} htmlFor="c-retro">
            Dias para trás
          </label>
          <input
            id="c-retro"
            type="number"
            min={1}
            max={30}
            className={campo}
            value={form.dias_retroativos}
            onChange={(e) => alterar('dias_retroativos', e.target.value)}
          />
        </div>
        <div>
          <label className={rotulo} htmlFor="c-padrao">
            Prazo padrão
          </label>
          <input
            id="c-padrao"
            type="number"
            min={1}
            max={365}
            className={campo}
            value={form.prazo_padrao_dias}
            onChange={(e) => alterar('prazo_padrao_dias', e.target.value)}
          />
        </div>
      </div>
      <p className={`${dica} -mt-1.5`}>
        "Dias para trás" é quantos dias do Diário cada busca relê. "Prazo padrão" é usado quando o texto da
        publicação não informa o prazo (o prazo fica para conferir). Valem para todos da organização.
      </p>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
        <input
          type="checkbox"
          className="ds-checkbox"
          checked={form.considerar_recesso}
          onChange={(e) => alterar('considerar_recesso', e.target.checked)}
        />
        Considerar recesso forense (20/12 a 20/01, CPC art. 220)
      </label>

      <div className={`${separador} pt-2`}>Botão Buscar agora</div>
      <div>
        <label className={rotulo} htmlFor="c-token">
          Token de segurança
        </label>
        <div className="flex gap-2">
          <input id="c-token" readOnly className={`${campo} font-mono text-[13px]`} value={form.webhook_token} />
          <button type="button" className={botaoPequeno} onClick={() => alterar('webhook_token', novoToken())}>
            Gerar novo
          </button>
        </div>
        {tokenAlterado ? (
          <div className={`${alertaAviso} mt-2`}>
            Novo token gerado. Ele só passa a valer quando você clicar em <strong>Salvar configurações</strong>
            ; o anterior deixa de funcionar nesse momento.
          </div>
        ) : (
          <p className={dica}>
            O robô só aceita o disparo do botão Buscar agora se este token conferir com o banco. Gere um
            novo se suspeitar que ele vazou.
          </p>
        )}
      </div>
      {erro && <div className={alertaErro}>{erro}</div>}
      <button type="submit" className={botaoPrimario} disabled={salvar.isPending || !escrita}>
        Salvar configurações
      </button>
    </form>
  )
}

function Feriados({ orgId, podeAlterar }: { orgId: string; podeAlterar: boolean }) {
  const avisar = useToast()
  const { escrita } = usePlano()
  const feriados = useFeriados(orgId)
  const criar = useCriarFeriado(orgId)
  const remover = useRemoverFeriado(orgId)
  const [data, setData] = useState('')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const lista = feriados.data ?? []
  const altera = podeAlterar && escrita

  function enviar(e: FormEvent) {
    e.preventDefault()
    const resultado = validarFeriado(
      { data, descricao },
      lista.map((f) => f.data),
    )
    if (!resultado.ok) {
      setErro(resultado.erro)
      return
    }
    setErro(null)
    criar.mutate(resultado.valor, {
      onSuccess: () => {
        setData('')
        setDescricao('')
        avisar('Feriado adicionado. Vale para os próximos cálculos.', 'ok')
      },
      onError: (falha) => setErro(`Não foi possível adicionar: ${mensagemDeErro(falha)}`),
    })
  }

  return (
    <section className={`${cartao} p-5`}>
      <h2 className="text-2xl font-bold text-navy">Feriados e suspensões locais</h2>
      <p className={`${dica} mb-4`}>
        Os feriados nacionais e a Sexta-feira Santa já são considerados. Cadastre aqui carnaval, Corpus
        Christi, feriados estaduais e municipais e suspensões de expediente do tribunal.
        {!podeAlterar && ' Só o Administrador da organização altera esta lista.'}
      </p>
      {podeAlterar && (
        <form onSubmit={enviar} noValidate className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
          <div>
            <label className={rotulo} htmlFor="f-data">
              Data
            </label>
            <input id="f-data" type="date" className={campo} value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <label className={rotulo} htmlFor="f-desc">
              Descrição
            </label>
            <input
              id="f-desc"
              placeholder="Ex.: Carnaval"
              className={campo}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
          <button type="submit" className={botaoPrimario} disabled={criar.isPending || !escrita}>
            Adicionar
          </button>
        </form>
      )}
      {erro && <div className={`${alertaErro} mt-3`}>{erro}</div>}
      {feriados.isError && (
        <div className={`${alertaErro} mt-3`}>Não foi possível carregar: {mensagemDeErro(feriados.error)}</div>
      )}
      <div className="mt-4 overflow-x-auto">
        <table className={tabela}>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              {podeAlterar && (
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {feriados.isSuccess && lista.length === 0 && (
              <tr>
                <td colSpan={podeAlterar ? 3 : 2} className={vazioTabela}>
                  Nenhum feriado local cadastrado.
                </td>
              </tr>
            )}
            {lista.map((f) => (
              <tr key={f.data}>
                <td className="whitespace-nowrap">{formatarData(f.data)}</td>
                <td>{f.descricao}</td>
                {podeAlterar && (
                  <td className="text-right">
                    <button
                      type="button"
                      className={botaoPerigoPequeno}
                      disabled={!altera}
                      onClick={() =>
                        remover.mutate(f.data, {
                          onSuccess: () => avisar('Feriado removido.'),
                          onError: (falha) => avisar(`Não foi possível remover: ${mensagemDeErro(falha)}`, 'erro'),
                        })
                      }
                    >
                      Remover
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
