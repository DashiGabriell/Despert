import { useState, type FormEvent } from 'react'
import {
  alertaAviso,
  alertaErro,
  botaoPerigoPequeno,
  botaoPrimario,
  campo,
  cartao,
  dica,
  rotulo,
  tabela,
  vazioTabela,
} from '../components/ui'
import {
  useAlternarMonitoramento,
  useCriarMonitoramento,
  useMembros,
  useMonitoramentos,
  useRemoverMonitoramento,
} from '../data/queries'
import { usePlano } from '../data/plano'
import {
  limiteDe,
  podeAdicionar,
  situacaoDoLimite,
  type Limites,
  type Recurso,
  type Uso,
} from '../domain/planos'
import { UFS, validarMonitoramento, type FormMonitoramento } from '../domain/validacao'
import { useUserId } from '../lib/auth-context'
import { useOrganizacaoId } from '../lib/organizacao-context'
import { mensagemDeErro, useToast } from '../lib/toast-context'

const FORM_VAZIO: FormMonitoramento = { tipo: 'oab', oab: '', uf: 'SP', processo: '', descricao: '' }

const NOMES_RECURSO: Record<'oabs' | 'processos', string> = {
  oabs: 'OABs monitoradas',
  processos: 'Processos avulsos',
}

/** Uso atual frente ao limite do plano; avisa a partir de 80% (ADR-0008). */
function UsoDoPlano({ limites, uso }: { limites: Limites; uso: Uso }) {
  const linhas = (['oabs', 'processos'] as const).map((recurso) => {
    const limite = limiteDe(recurso, limites, uso.advogados)
    return { recurso, limite, usados: uso[recurso], situacao: situacaoDoLimite(uso[recurso], limite) }
  })
  const alerta = linhas.find((l) => l.situacao === 'excedido') ?? linhas.find((l) => l.situacao === 'perto')
  return (
    <div className="mb-4 space-y-2">
      <p className="text-sm text-muted">
        {linhas.map((l, i) => (
          <span key={l.recurso}>
            {i > 0 && ' · '}
            {NOMES_RECURSO[l.recurso]} ativos:{' '}
            <strong className="text-ink">
              {l.usados} de {l.limite}
            </strong>
          </span>
        ))}
      </p>
      {alerta?.situacao === 'excedido' && (
        <div className={alertaErro}>
          {NOMES_RECURSO[alerta.recurso]} ativos acima do que o plano permite ({alerta.usados} de {alerta.limite}).
          Pause os que não precisam de acompanhamento; enquanto isso, nada novo pode ser cadastrado.
        </div>
      )}
      {alerta?.situacao === 'perto' && (
        <div className={alertaAviso}>
          {NOMES_RECURSO[alerta.recurso]} ativos: {alerta.usados} de {alerta.limite} do plano. Perto do limite.
        </div>
      )}
    </div>
  )
}

export default function Monitoramento() {
  const userId = useUserId()
  const orgId = useOrganizacaoId()
  const avisar = useToast()
  const monitoramentos = useMonitoramentos(orgId)
  const criar = useCriarMonitoramento(orgId, userId)
  const alternar = useAlternarMonitoramento(orgId)
  const remover = useRemoverMonitoramento(orgId)
  const membros = useMembros(orgId)
  const { limites, escrita } = usePlano()
  const [form, setForm] = useState<FormMonitoramento>(FORM_VAZIO)
  const [erro, setErro] = useState<string | null>(null)

  const lista = monitoramentos.data ?? []
  // Enquanto os membros carregam, conta só a própria pessoa.
  const uso: Uso = {
    usuarios: membros.data?.length ?? 1,
    advogados: membros.data
      ? membros.data.filter((m) => m.papel === 'administrador' || m.papel === 'advogado').length
      : 1,
    oabs: lista.filter((m) => m.ativo && m.tipo === 'oab').length,
    processos: lista.filter((m) => m.ativo && m.tipo === 'processo').length,
  }
  const recursoDoForm: Recurso = form.tipo === 'oab' ? 'oabs' : 'processos'
  const cheio = !podeAdicionar(recursoDoForm, limites, uso)

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (cheio) return
    const resultado = validarMonitoramento(form, lista)
    if (!resultado.ok) {
      setErro(resultado.erro)
      return
    }
    setErro(null)
    criar.mutate(resultado.valor, {
      onSuccess: () => {
        setForm({ ...FORM_VAZIO, tipo: form.tipo, uf: form.uf })
        avisar('Monitoramento adicionado. Ele entra na próxima busca.', 'ok')
      },
      onError: (falha) => setErro(`Não foi possível adicionar: ${mensagemDeErro(falha)}`),
    })
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section className={`${cartao} p-5`}>
        <h2 className="mb-4 text-2xl font-bold text-navy">Adicionar monitoramento</h2>
        <UsoDoPlano limites={limites} uso={uso} />
        {!escrita && (
          <div className={`${alertaAviso} mb-4`}>Organização em modo somente leitura: não é possível alterar os monitoramentos.</div>
        )}
        <form onSubmit={enviar} noValidate className="space-y-3.5">
          <div>
            <label className={rotulo} htmlFor="m-tipo">
              Tipo
            </label>
            <select
              id="m-tipo"
              className={campo}
              value={form.tipo}
              onChange={(e) => {
                setForm({ ...form, tipo: e.target.value as FormMonitoramento['tipo'] })
                setErro(null)
              }}
            >
              <option value="oab">Número da OAB (todas as intimações da advogada)</option>
              <option value="processo">Processo específico</option>
            </select>
          </div>
          {form.tipo === 'oab' ? (
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3.5">
              <div>
                <label className={rotulo} htmlFor="m-oab">
                  Número da OAB
                </label>
                <input
                  id="m-oab"
                  inputMode="numeric"
                  placeholder="123456"
                  className={campo}
                  value={form.oab}
                  onChange={(e) => setForm({ ...form, oab: e.target.value })}
                />
              </div>
              <div>
                <label className={rotulo} htmlFor="m-uf">
                  UF
                </label>
                <select
                  id="m-uf"
                  className={campo}
                  value={form.uf}
                  onChange={(e) => setForm({ ...form, uf: e.target.value })}
                >
                  {UFS.map((uf) => (
                    <option key={uf}>{uf}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className={rotulo} htmlFor="m-proc">
                Número do processo (CNJ)
              </label>
              <input
                id="m-proc"
                placeholder="0000000-00.0000.0.00.0000"
                className={`${campo} font-mono`}
                value={form.processo}
                onChange={(e) => setForm({ ...form, processo: e.target.value })}
              />
              <p className={dica}>20 dígitos, com ou sem pontuação.</p>
            </div>
          )}
          <div>
            <label className={rotulo} htmlFor="m-desc">
              Descrição (opcional)
            </label>
            <input
              id="m-desc"
              placeholder="Ex.: OAB principal, Cliente X…"
              className={campo}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>
          {erro && <div className={alertaErro}>{erro}</div>}
          {cheio && escrita && (
            <div className={alertaAviso}>
              {form.tipo === 'oab'
                ? 'O limite de OABs monitoradas foi atingido. Pause uma OAB para cadastrar outra ou fale com o suporte.'
                : 'O limite de processos avulsos foi atingido. Pause um processo para cadastrar outro ou fale com o suporte.'}
            </div>
          )}
          <button type="submit" className={botaoPrimario} disabled={criar.isPending || cheio || !escrita}>
            Adicionar
          </button>
        </form>
      </section>

      <section className={cartao}>
        <h2 className="border-b border-line px-5 py-4 text-2xl font-bold text-navy">O que está sendo monitorado</h2>
        {monitoramentos.isError && (
          <div className={`${alertaErro} m-3.5`}>
            Não foi possível carregar: {mensagemDeErro(monitoramentos.error)}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className={tabela}>
            <thead>
              <tr>
                <th>Ativo</th>
                <th>Monitoramento</th>
                <th>Descrição</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {monitoramentos.isPending && (
                <tr>
                  <td colSpan={4} className="space-y-2.5 py-5">
                    <span className="sr-only">Carregando…</span>
                    <div className="ds-skeleton h-4 w-2/3" />
                    <div className="ds-skeleton h-4 w-1/2" />
                  </td>
                </tr>
              )}
              {monitoramentos.isSuccess && lista.length === 0 && (
                <tr>
                  <td colSpan={4} className={vazioTabela}>
                    Nada cadastrado ainda. Adicione a sua OAB ao lado para o robô começar a buscar as
                    intimações no Diário.
                  </td>
                </tr>
              )}
              {lista.map((m) => {
                const nome =
                  m.tipo === 'oab' ? `OAB ${m.oab_numero}/${m.oab_uf}` : (m.numero_processo ?? '')
                return (
                  <tr key={m.id} className={m.ativo ? '' : '[&>td]:text-muted'}>
                    <td>
                      <label className="ds-switch">
                        <input
                          type="checkbox"
                          className="sr-only"
                          aria-label={`${m.ativo ? 'Desativar' : 'Ativar'} ${nome}`}
                          checked={m.ativo}
                          disabled={alternar.isPending || !escrita}
                          onChange={(e) =>
                            alternar.mutate(
                              { id: m.id, ativo: e.target.checked },
                              {
                                onError: (falha) =>
                                  avisar(`Não foi possível atualizar: ${mensagemDeErro(falha)}`, 'erro'),
                              },
                            )
                          }
                        />
                        <span aria-hidden />
                      </label>
                    </td>
                    <td>
                      {m.tipo === 'oab' ? (
                        <strong>{nome}</strong>
                      ) : (
                        <>
                          <span className="font-mono text-[13px]">{nome}</span>
                          <div className="text-xs text-muted">Processo</div>
                        </>
                      )}
                    </td>
                    <td>{m.descricao}</td>
                    <td className={`text-right`}>
                      <button
                        type="button"
                        className={botaoPerigoPequeno}
                        disabled={!escrita}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Remover ${nome}? Ele sai das próximas buscas; os prazos já capturados continuam salvos.`,
                            )
                          ) {
                            return
                          }
                          remover.mutate(m.id, {
                            onSuccess: () => avisar('Monitoramento removido.'),
                            onError: (falha) =>
                              avisar(`Não foi possível remover: ${mensagemDeErro(falha)}`, 'erro'),
                          })
                        }}
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
