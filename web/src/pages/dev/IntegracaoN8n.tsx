import { useState, type FormEvent } from 'react'
import { alertaAviso, alertaErro, alertaOk, botao, botaoPrimario, campo, cartao, dica, rotulo } from '../../components/ui'
import { chamarWebhook, useContasAdmin, useDispararBusca, useSalvarWebhookSistema } from '../../data/admin'
import { useConfiguracaoSistema } from '../../data/queries'
import { interpretarTesteWebhook, type ResultadoTesteWebhook } from '../../domain/acesso'
import { urlDisparo } from '../../domain/busca'
import { formatarDataHora } from '../../domain/datas'
import { validarUrlWebhook } from '../../domain/validacao'
import { useAuth } from '../../lib/auth-context'
import type { ConfiguracaoSistema } from '../../lib/database.types'
import { mensagemDeErro, useToast } from '../../lib/toast-context'

const ALERTA: Record<ResultadoTesteWebhook['tipo'], string> = {
  ok: alertaOk,
  aviso: alertaAviso,
  erro: alertaErro,
}

export default function IntegracaoN8n() {
  const sistema = useConfiguracaoSistema()

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
      <section className={`${cartao} p-5`}>
        <h2 className="mb-1 text-xl font-bold text-navy">Webhook do n8n</h2>
        <p className={`${dica} mb-4`}>
          Production URL do nó <strong>Disparo pelo Site</strong> do fluxo do Supabase, com o fluxo ativo. Vale para todos os
          advogados; só contas dev veem e alteram esta configuração.
        </p>
        {sistema.isPending && (
          <div className="space-y-3">
            <span className="sr-only">Carregando…</span>
            <div className="ds-skeleton h-10" />
            <div className="ds-skeleton h-10 w-1/2" />
          </div>
        )}
        {sistema.isError && (
          <div className={alertaErro}>Não foi possível carregar: {mensagemDeErro(sistema.error)}</div>
        )}
        {sistema.isSuccess &&
          (sistema.data ? (
            <FormularioWebhook key={sistema.data.updated_at} sistema={sistema.data} />
          ) : (
            <div className={alertaErro}>
              A linha de <code>configuracao_sistema</code> não existe. Rode o <code>supabase/schema.sql</code>{' '}
              atualizado no SQL Editor.
            </div>
          ))}
      </section>
      <DispararBusca webhookUrl={sistema.data?.n8n_webhook_url.trim() ?? ''} />
    </div>
  )
}

function FormularioWebhook({ sistema }: { sistema: ConfiguracaoSistema }) {
  const avisar = useToast()
  const salvar = useSalvarWebhookSistema()
  const contas = useContasAdmin()
  const [url, setUrl] = useState(sistema.n8n_webhook_url)
  const [erro, setErro] = useState<string | null>(null)
  const [testando, setTestando] = useState(false)
  const [teste, setTeste] = useState<ResultadoTesteWebhook | null>(null)
  const alterada = url.trim() !== sistema.n8n_webhook_url
  const autor = sistema.updated_by ? contas.data?.find((c) => c.id === sistema.updated_by)?.email : undefined

  function enviar(e: FormEvent) {
    e.preventDefault()
    const resultado = validarUrlWebhook(url)
    if (!resultado.ok) {
      setErro(resultado.erro)
      return
    }
    setErro(null)
    salvar.mutate(resultado.valor, {
      onSuccess: () =>
        avisar(resultado.valor ? 'URL salva. O Buscar agora já usa o novo endereço.' : 'URL removida: o Buscar agora foi desligado.', 'ok'),
      onError: (falha) => setErro(`Não foi possível salvar: ${mensagemDeErro(falha)}`),
    })
  }

  async function testar() {
    const resultado = validarUrlWebhook(url)
    if (!resultado.ok || !resultado.valor) {
      setErro(resultado.ok ? 'Informe a URL antes de testar.' : resultado.erro)
      return
    }
    setErro(null)
    setTeste(null)
    setTestando(true)
    try {
      setTeste(interpretarTesteWebhook(await chamarWebhook(urlDisparo(resultado.valor, 'teste-de-conexao'))))
    } catch (falha) {
      setTeste({ tipo: 'erro', mensagem: `Não foi possível alcançar o n8n: ${mensagemDeErro(falha)}` })
    } finally {
      setTestando(false)
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-3.5">
      <div>
        <label className={rotulo} htmlFor="n8n-url">
          URL do webhook
        </label>
        <input
          id="n8n-url"
          type="url"
          className={`${campo} font-mono text-[13px]`}
          placeholder="https://n8n.seudominio.com/webhook/monitor-prazos"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <p className={dica}>Deixe vazio para desligar o Buscar agora de todos.</p>
      </div>
      <p className="text-sm text-muted">
        Última alteração: {formatarDataHora(sistema.updated_at)}
        {autor ? ` por ${autor}` : ''}.
      </p>
      {alterada && <div className={alertaAviso}>Alteração ainda não salva.</div>}
      {erro && <div className={alertaErro}>{erro}</div>}
      {teste && <div className={ALERTA[teste.tipo]}>{teste.mensagem}</div>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={botaoPrimario} disabled={salvar.isPending}>
          Salvar URL
        </button>
        <button type="button" className={botao} disabled={testando} onClick={() => void testar()}>
          {testando ? 'Testando…' : 'Testar conexão'}
        </button>
      </div>
      <p className={dica}>
        O teste usa um token inválido de propósito: o fluxo responde sem buscar nada e não gasta consulta ao
        Diário. Se o fluxo estiver inativo, o n8n responde 404.
      </p>
    </form>
  )
}

function DispararBusca({ webhookUrl }: { webhookUrl: string }) {
  const avisar = useToast()
  const { sessao } = useAuth()
  const contas = useContasAdmin()
  const disparar = useDispararBusca()
  const [contaId, setContaId] = useState('')
  const advogados = (contas.data ?? []).filter((c) => c.app_role !== 'dev' && !c.bloqueado)
  const conta = advogados.find((c) => c.id === contaId)

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!sessao || !conta) return
    disparar.mutate(
      {
        webhookUrl,
        conta: { id: conta.id, email: conta.email },
        dev: { id: sessao.user.id, email: sessao.user.email },
      },
      {
        onSuccess: (status) => {
          const resultado = interpretarTesteWebhook(status)
          avisar(
            resultado.tipo === 'erro'
              ? resultado.mensagem
              : `Busca disparada para ${conta.email}. Acompanhe em Execuções.`,
            resultado.tipo === 'erro' ? 'erro' : 'ok',
          )
        },
        onError: (falha) => avisar(`Não foi possível disparar: ${mensagemDeErro(falha)}`, 'erro'),
      },
    )
  }

  return (
    <section className={`${cartao} p-5`}>
      <h2 className="mb-1 text-xl font-bold text-navy">Disparar busca para um advogado</h2>
      <p className={`${dica} mb-4`}>
        Roda o robô agora para a conta escolhida, com o token dela, como se ela tivesse clicado em Buscar
        agora. Fica registrado na auditoria.
      </p>
      {!webhookUrl ? (
        <div className={alertaAviso}>Salve a URL do webhook antes de disparar buscas.</div>
      ) : (
        <form onSubmit={enviar} noValidate className="flex flex-wrap items-end gap-2">
          <div className="min-w-60 flex-1">
            <label className={rotulo} htmlFor="n8n-conta">
              Advogado
            </label>
            <select id="n8n-conta" className={campo} value={contaId} onChange={(e) => setContaId(e.target.value)}>
              <option value="">Selecione…</option>
              {advogados.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.email}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={botaoPrimario} disabled={!conta || disparar.isPending}>
            {disparar.isPending ? 'Disparando…' : 'Disparar busca'}
          </button>
        </form>
      )}
    </section>
  )
}
