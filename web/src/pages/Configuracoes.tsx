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
import {
  useConfiguracao,
  useCriarFeriado,
  useFeriados,
  useRemoverFeriado,
  useSalvarConfiguracao,
} from '../data/queries'
import { formatarData } from '../domain/datas'
import { validarConfiguracao, validarFeriado, type FormConfiguracao } from '../domain/validacao'
import { useEmailEfetivo, useUserId } from '../lib/auth-context'
import type { Configuracao } from '../lib/database.types'
import { mensagemDeErro, useToast } from '../lib/toast-context'
import { novoToken } from '../domain/token'

export default function Configuracoes() {
  const userId = useUserId()
  const email = useEmailEfetivo()
  const config = useConfiguracao(userId, email)

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
      <section className={`${cartao} p-5`}>
        <h2 className="mb-4 text-2xl font-bold text-navy">Configurações do robô</h2>
        {config.isPending && (
          <div className="space-y-3">
            <span className="sr-only">Carregando…</span>
            <div className="ds-skeleton h-10" />
            <div className="ds-skeleton h-10" />
            <div className="ds-skeleton h-10 w-2/3" />
          </div>
        )}
        {config.isError && (
          <div className={alertaErro}>Não foi possível carregar: {mensagemDeErro(config.error)}</div>
        )}
        {config.data && (
          <FormularioConfiguracao key={config.data.updated_at} userId={userId} config={config.data} />
        )}
      </section>
      <Feriados userId={userId} />
    </div>
  )
}

function FormularioConfiguracao({ userId, config }: { userId: string; config: Configuracao }) {
  const avisar = useToast()
  const salvar = useSalvarConfiguracao(userId)
  const [form, setForm] = useState<FormConfiguracao>({
    email_destino: config.email_destino,
    dias_retroativos: String(config.dias_retroativos),
    prazo_padrao_dias: String(config.prazo_padrao_dias),
    dias_alerta: String(config.dias_alerta),
    considerar_recesso: config.considerar_recesso,
    webhook_token: config.webhook_token,
  })
  const [erro, setErro] = useState<string | null>(null)
  const tokenAlterado = form.webhook_token !== config.webhook_token

  function alterar<K extends keyof FormConfiguracao>(chave: K, valor: FormConfiguracao[K]) {
    setForm((atual) => ({ ...atual, [chave]: valor }))
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    const resultado = validarConfiguracao(form)
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
      <div>
        <label className={rotulo} htmlFor="c-email">
          E-mail para alertas
        </label>
        <input
          id="c-email"
          type="email"
          className={campo}
          value={form.email_destino}
          onChange={(e) => alterar('email_destino', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
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
            onChange={(e) => alterar('dias_alerta', e.target.value)}
          />
        </div>
      </div>
      <p className={`${dica} -mt-1.5`}>
        "Dias para trás" é quantos dias do Diário cada busca relê. "Prazo padrão" é usado quando o texto da
        publicação não informa o prazo (o prazo fica para conferir). "Janela de alerta" define quantos dias
        à frente entram no resumo diário por e-mail.
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
          <button
            type="button"
            className={botaoPequeno}
            onClick={() => alterar('webhook_token', novoToken())}
          >
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
      <button type="submit" className={botaoPrimario} disabled={salvar.isPending}>
        Salvar configurações
      </button>
    </form>
  )
}

function Feriados({ userId }: { userId: string }) {
  const avisar = useToast()
  const feriados = useFeriados(userId)
  const criar = useCriarFeriado(userId)
  const remover = useRemoverFeriado(userId)
  const [data, setData] = useState('')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const lista = feriados.data ?? []

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
      </p>
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
        <button type="submit" className={botaoPrimario} disabled={criar.isPending}>
          Adicionar
        </button>
      </form>
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
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {feriados.isSuccess && lista.length === 0 && (
              <tr>
                <td colSpan={3} className={vazioTabela}>
                  Nenhum feriado local cadastrado.
                </td>
              </tr>
            )}
            {lista.map((f) => (
              <tr key={f.data}>
                <td className={`whitespace-nowrap`}>{formatarData(f.data)}</td>
                <td>{f.descricao}</td>
                <td className={`text-right`}>
                  <button
                    type="button"
                    className={botaoPerigoPequeno}
                    onClick={() =>
                      remover.mutate(f.data, {
                        onSuccess: () => avisar('Feriado removido.'),
                        onError: (falha) =>
                          avisar(`Não foi possível remover: ${mensagemDeErro(falha)}`, 'erro'),
                      })
                    }
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
