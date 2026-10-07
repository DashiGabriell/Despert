import { useState, type FormEvent } from 'react'
import Modal from '../../components/Modal'
import {
  alertaAviso,
  alertaErro,
  botao,
  botaoPequeno,
  botaoPrimario,
  campo,
  cartao,
  dica,
  rotulo,
  separador,
  tabela,
  vazioTabela,
} from '../../components/ui'
import {
  useAtualizarOrganizacao,
  useContasAdmin,
  useCriarOrganizacao,
  useOrganizacoesAdmin,
  useSalvarCarencia,
} from '../../data/admin'
import { useConfiguracaoSistema } from '../../data/queries'
import { useHoje } from '../../data/relogio'
import { formatarData, hojeISO } from '../../domain/datas'
import type { DataISO } from '../../domain/dias'
import {
  camposDosAjustes,
  carenciaDe,
  CHAVES_LIMITES,
  descreverLimite,
  estenderPagamento,
  etapaDaOrganizacao,
  LIMITES_PADRAO,
  limiteDe,
  limitesEfetivos,
  PLANOS,
  ROTULO_LIMITE,
  ROTULO_PLANO,
  ultimoDiaDeAcesso,
  validarAjustes,
  validarCarencia,
  type Carencia,
  type CamposAjustes,
  type Etapa,
} from '../../domain/planos'
import { validarNovaConta } from '../../domain/validacao'
import type { OrganizacaoAdmin, Plano, RotuloOrganizacao, SituacaoOrganizacao } from '../../lib/database.types'
import { mensagemDeErro, useToast } from '../../lib/toast-context'

const ROTULO_ETAPA: Record<Etapa, [string, string]> = {
  teste: ['Em teste', 'ds-badge-coin'],
  ativa: ['Ativa', 'ds-badge-success'],
  aviso: ['Carência: aviso', 'ds-badge-warning'],
  leitura: ['Carência: somente leitura', 'ds-badge-destructive'],
  suspensa: ['Suspensa', 'ds-badge-secondary'],
}

const ROTULO_TIPO: Record<RotuloOrganizacao, string> = {
  escritorio: 'Escritório',
  departamento_juridico: 'Departamento jurídico',
}

export default function Organizacoes() {
  const organizacoes = useOrganizacoesAdmin()
  const sistema = useConfiguracaoSistema()
  const hoje = useHoje()
  const carencia = carenciaDe(sistema.data)
  const [gerenciandoId, setGerenciandoId] = useState<string | null>(null)
  const lista = organizacoes.data ?? []
  const gerenciando = lista.find((o) => o.id === gerenciandoId) ?? null

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <NovaOrganizacao />
        {sistema.data && <TesteECarencia key={sistema.data.updated_at} atual={carencia} />}
      </div>

      <section className={cartao}>
        <h2 className="border-b border-line px-4 py-3 text-xl font-bold text-navy">
          Organizações ({lista.length})
        </h2>
        {organizacoes.isError && (
          <div className={`${alertaErro} m-3.5`}>
            Não foi possível carregar: {mensagemDeErro(organizacoes.error)}. Confira se o{' '}
            <code>supabase/schema.sql</code> atualizado foi aplicado.
          </div>
        )}
        <div className="overflow-x-auto">
          <table className={tabela}>
            <thead>
              <tr>
                <th>Organização</th>
                <th>Plano</th>
                <th>Situação</th>
                <th>Usuários</th>
                <th>OABs</th>
                <th>Processos</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {organizacoes.isPending && (
                <tr>
                  <td colSpan={7} className="space-y-2.5 py-5">
                    <span className="sr-only">Carregando…</span>
                    <div className="ds-skeleton h-4 w-3/4" />
                    <div className="ds-skeleton h-4 w-1/2" />
                  </td>
                </tr>
              )}
              {organizacoes.isSuccess && lista.length === 0 && (
                <tr>
                  <td colSpan={7} className={vazioTabela}>
                    Nenhuma organização.
                  </td>
                </tr>
              )}
              {lista.map((o) => {
                const limites = limitesEfetivos(o.plano, o.limites)
                const etapa = etapaDaOrganizacao(o, hoje, carencia)
                const fim = ultimoDiaDeAcesso(o, carencia)
                const [textoEtapa, corEtapa] = ROTULO_ETAPA[etapa]
                const ajustado = Object.values(camposDosAjustes(o.limites)).some((v) => v !== '')
                return (
                  <tr key={o.id}>
                    <td>
                      <div className="font-semibold">{o.nome || '(sem nome)'}</div>
                      <div className="text-xs break-all text-muted">
                        {ROTULO_TIPO[o.rotulo]} · {o.administrador_email ?? 'sem administrador'}
                      </div>
                    </td>
                    <td>
                      {ROTULO_PLANO[o.plano]}
                      {ajustado && <span className="ds-badge ds-badge-navy ml-1.5">ajustado</span>}
                    </td>
                    <td>
                      <span className={`ds-badge ${corEtapa}`}>{textoEtapa}</span>
                      <div className="mt-1 text-xs text-muted">
                        {fim ? `${o.situacao === 'teste' ? 'Teste até' : 'Pago até'} ${formatarData(fim)}` : 'Sem vencimento'}
                      </div>
                    </td>
                    <td>
                      {o.qtd_membros} / {limites.usuarios}
                    </td>
                    <td>
                      {o.oabs_ativas} / {limiteDe('oabs', limites, o.qtd_advogados)}
                    </td>
                    <td>
                      {o.processos_ativos} / {limites.processos}
                    </td>
                    <td className="text-right">
                      <button type="button" className={botaoPequeno} onClick={() => setGerenciandoId(o.id)}>
                        Gerenciar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {gerenciando && (
        <GerenciarOrganizacao
          key={gerenciando.id}
          organizacao={gerenciando}
          hoje={hoje}
          carencia={carencia}
          onFechar={() => setGerenciandoId(null)}
        />
      )}
    </div>
  )
}

function NovaOrganizacao() {
  const avisar = useToast()
  const contas = useContasAdmin()
  const criar = useCriarOrganizacao()
  const vazio = { nome: '', rotulo: 'escritorio' as RotuloOrganizacao, plano: 'escritorio' as Plano, email: '', senha: '' }
  const [form, setForm] = useState(vazio)
  const [erro, setErro] = useState<string | null>(null)

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) {
      setErro('Informe o nome da organização.')
      return
    }
    const conta = validarNovaConta(
      { email: form.email, senha: form.senha, papel: 'advogado' },
      (contas.data ?? []).map((c) => c.email),
    )
    if (!conta.ok) {
      setErro(conta.erro)
      return
    }
    setErro(null)
    criar.mutate(
      { nome: form.nome.trim(), rotulo: form.rotulo, plano: form.plano, email: conta.valor.email, senha: conta.valor.senha },
      {
        onSuccess: () => {
          setForm(vazio)
          avisar(`Organização criada. Passe o acesso de ${conta.valor.email} por um canal seguro.`, 'ok')
        },
        onError: (falha) => setErro(`Não foi possível criar: ${mensagemDeErro(falha)}`),
      },
    )
  }

  return (
    <section className={`${cartao} p-5`}>
      <h2 className="mb-1 text-xl font-bold text-navy">Nova organização</h2>
      <p className={`${dica} mb-4`}>
        Para contratos fechados fora do app (ex.: Corporativo). Cria a conta do Administrador já confirmada e a
        organização ativa, sem vencimento; registre o pagamento depois em Gerenciar.
      </p>
      <form onSubmit={enviar} noValidate className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className={rotulo} htmlFor="o-nome">
            Nome
          </label>
          <input
            id="o-nome"
            className={campo}
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
          />
        </div>
        <div>
          <label className={rotulo} htmlFor="o-rotulo">
            Tipo
          </label>
          <select
            id="o-rotulo"
            className={campo}
            value={form.rotulo}
            onChange={(e) => setForm({ ...form, rotulo: e.target.value as RotuloOrganizacao })}
          >
            <option value="escritorio">Escritório</option>
            <option value="departamento_juridico">Departamento jurídico</option>
          </select>
        </div>
        <div>
          <label className={rotulo} htmlFor="o-plano">
            Plano
          </label>
          <select
            id="o-plano"
            className={campo}
            value={form.plano}
            onChange={(e) => setForm({ ...form, plano: e.target.value as Plano })}
          >
            {PLANOS.map((p) => (
              <option key={p} value={p}>
                {ROTULO_PLANO[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={rotulo} htmlFor="o-email">
            E-mail do Administrador
          </label>
          <input
            id="o-email"
            type="email"
            autoComplete="off"
            className={campo}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className={rotulo} htmlFor="o-senha">
            Senha inicial
          </label>
          <input
            id="o-senha"
            type="text"
            autoComplete="off"
            className={campo}
            value={form.senha}
            onChange={(e) => setForm({ ...form, senha: e.target.value })}
          />
        </div>
        {erro && <div className={`${alertaErro} md:col-span-2`}>{erro}</div>}
        <div className="md:col-span-2">
          <button type="submit" className={botaoPrimario} disabled={criar.isPending}>
            {criar.isPending ? 'Criando…' : 'Criar organização'}
          </button>
        </div>
      </form>
    </section>
  )
}

function TesteECarencia({ atual }: { atual: Carencia }) {
  const avisar = useToast()
  const salvar = useSalvarCarencia()
  const [form, setForm] = useState({
    dias_teste: String(atual.dias_teste),
    carencia_aviso_dias: String(atual.carencia_aviso_dias),
    carencia_total_dias: String(atual.carencia_total_dias),
  })
  const [erro, setErro] = useState<string | null>(null)

  function enviar(e: FormEvent) {
    e.preventDefault()
    const resultado = validarCarencia(form)
    if (!resultado.ok) {
      setErro(resultado.erro)
      return
    }
    setErro(null)
    salvar.mutate(resultado.valor, {
      onSuccess: () => avisar('Prazos de teste e carência salvos. Valem para todas as organizações.', 'ok'),
      onError: (falha) => setErro(`Não foi possível salvar: ${mensagemDeErro(falha)}`),
    })
  }

  const campos: [keyof typeof form, string, string][] = [
    ['dias_teste', 'Dias de teste', 'Contando o dia do cadastro.'],
    ['carencia_aviso_dias', 'Dias de aviso', 'Depois do vencimento, tudo funciona com aviso ao Administrador.'],
    ['carencia_total_dias', 'Carência total', 'Até aqui, somente leitura com o robô buscando; depois, suspensa.'],
  ]

  return (
    <section className={`${cartao} p-5`}>
      <h2 className="mb-1 text-xl font-bold text-navy">Teste e carência</h2>
      <p className={`${dica} mb-4`}>Em dias. Nada é apagado em nenhuma etapa.</p>
      <form onSubmit={enviar} noValidate className="space-y-3">
        {campos.map(([chave, nome, ajuda]) => (
          <div key={chave}>
            <label className={rotulo} htmlFor={`c-${chave}`}>
              {nome}
            </label>
            <input
              id={`c-${chave}`}
              inputMode="numeric"
              className={campo}
              value={form[chave]}
              onChange={(e) => setForm({ ...form, [chave]: e.target.value })}
            />
            <p className={dica}>{ajuda}</p>
          </div>
        ))}
        {erro && <div className={alertaErro}>{erro}</div>}
        <button type="submit" className={botaoPrimario} disabled={salvar.isPending}>
          Salvar
        </button>
      </form>
    </section>
  )
}

function GerenciarOrganizacao({
  organizacao: o,
  hoje,
  carencia,
  onFechar,
}: {
  organizacao: OrganizacaoAdmin
  hoje: DataISO
  carencia: Carencia
  onFechar: () => void
}) {
  const avisar = useToast()
  const atualizar = useAtualizarOrganizacao()
  const [nome, setNome] = useState(o.nome)
  const [tipo, setTipo] = useState<RotuloOrganizacao>(o.rotulo)
  const [plano, setPlano] = useState<Plano>(o.plano)
  const [situacao, setSituacao] = useState<SituacaoOrganizacao>(o.situacao)
  const [pagoAte, setPagoAte] = useState(o.pago_ate ?? '')
  const [ajustes, setAjustes] = useState<CamposAjustes>(() => camposDosAjustes(o.limites))
  const [erro, setErro] = useState<string | null>(null)

  const padrao = LIMITES_PADRAO[plano]
  const ordemPlano = (p: Plano) => PLANOS.indexOf(p)
  const rebaixando = ordemPlano(plano) < ordemPlano(o.plano)
  const etapaPrevista = etapaDaOrganizacao(
    { ...o, situacao, pago_ate: pagoAte || null },
    hoje,
    carencia,
  )

  function registrarPagamento(meses: number) {
    setSituacao('ativa')
    setPagoAte(estenderPagamento(pagoAte || null, hoje, meses))
  }

  function salvar(e: FormEvent) {
    e.preventDefault()
    const resultado = validarAjustes(ajustes)
    if (!resultado.ok) {
      setErro(resultado.erro)
      return
    }
    setErro(null)
    atualizar.mutate(
      {
        id: o.id,
        dados: {
          nome: nome.trim(),
          rotulo: tipo,
          plano,
          situacao,
          pago_ate: situacao === 'ativa' && pagoAte ? pagoAte : null,
          limites: { ...resultado.valor },
        },
      },
      {
        onSuccess: () => {
          avisar('Organização atualizada.', 'ok')
          onFechar()
        },
        onError: (falha) => setErro(`Não foi possível salvar: ${mensagemDeErro(falha)}`),
      },
    )
  }

  return (
    <Modal
      titulo="Gerenciar organização"
      subtitulo={
        <>
          <span>{o.nome || '(sem nome)'}</span>
          <span className={`ds-badge ${ROTULO_ETAPA[etapaPrevista][1]}`}>{ROTULO_ETAPA[etapaPrevista][0]}</span>
        </>
      }
      onFechar={onFechar}
      rodape={
        <>
          <button type="button" className={botao} onClick={onFechar}>
            Cancelar
          </button>
          <button type="submit" form="form-organizacao" className={botaoPrimario} disabled={atualizar.isPending}>
            {atualizar.isPending ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <form id="form-organizacao" onSubmit={salvar} noValidate className="space-y-5">
        {erro && <div className={alertaErro}>{erro}</div>}

        <div>
          <div className={separador}>Dados</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={rotulo} htmlFor="g-nome">
                Nome
              </label>
              <input id="g-nome" className={campo} value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <label className={rotulo} htmlFor="g-tipo">
                Tipo
              </label>
              <select
                id="g-tipo"
                className={campo}
                value={tipo}
                onChange={(e) => setTipo(e.target.value as RotuloOrganizacao)}
              >
                <option value="escritorio">Escritório</option>
                <option value="departamento_juridico">Departamento jurídico</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <div className={separador}>Plano</div>
          <select
            aria-label="Plano"
            className={campo}
            value={plano}
            onChange={(e) => setPlano(e.target.value as Plano)}
          >
            {PLANOS.map((p) => (
              <option key={p} value={p}>
                {ROTULO_PLANO[p]}
              </option>
            ))}
          </select>
          {rebaixando && (
            <div className={`${alertaAviso} mt-2`}>
              Plano menor: nada é apagado, mas os monitoramentos acima do novo limite são pausados (os mais novos) e
              os usuários excedentes passam a Leitura.
            </div>
          )}
        </div>

        <div>
          <div className={separador}>Pagamento</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={rotulo} htmlFor="g-situacao">
                Situação
              </label>
              <select
                id="g-situacao"
                className={campo}
                value={situacao}
                onChange={(e) => setSituacao(e.target.value as SituacaoOrganizacao)}
              >
                <option value="teste">Em teste</option>
                <option value="ativa">Ativa (contratada)</option>
              </select>
              {situacao === 'teste' && (
                <p className={dica}>
                  Teste iniciado em {formatarData(hojeISO(new Date(o.teste_iniciado_em ?? o.criado_em)))}.
                </p>
              )}
            </div>
            <div>
              <label className={rotulo} htmlFor="g-pago">
                Pago até
              </label>
              <input
                id="g-pago"
                type="date"
                className={campo}
                disabled={situacao !== 'ativa'}
                value={pagoAte}
                onChange={(e) => setPagoAte(e.target.value)}
              />
              <p className={dica}>Vazio = sem vencimento.</p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={botaoPequeno} onClick={() => registrarPagamento(1)}>
              Registrar pagamento de 1 mês
            </button>
            <button type="button" className={botaoPequeno} onClick={() => registrarPagamento(12)}>
              Registrar pagamento de 12 meses
            </button>
          </div>
        </div>

        <div>
          <div className={separador}>Ajustes de limite</div>
          <p className={`${dica} mb-3`}>Vazio usa o padrão do plano {ROTULO_PLANO[plano]}.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CHAVES_LIMITES.map((chave) => {
              const id = `g-lim-${chave}`
              const padraoTexto = descreverLimite(padrao[chave])
              return (
                <div key={chave}>
                  <label className={rotulo} htmlFor={id}>
                    {ROTULO_LIMITE[chave]}
                  </label>
                  {chave === 'papeis' || chave === 'auditoria' ? (
                    <select
                      id={id}
                      className={campo}
                      value={ajustes[chave]}
                      onChange={(e) => setAjustes({ ...ajustes, [chave]: e.target.value })}
                    >
                      <option value="">Padrão ({padraoTexto})</option>
                      <option value="sim">Sim</option>
                      <option value="nao">Não</option>
                    </select>
                  ) : chave === 'oabs' ? (
                    <>
                      <input
                        id={id}
                        className={campo}
                        list="g-oabs-opcoes"
                        placeholder={`Padrão (${padraoTexto})`}
                        value={ajustes.oabs}
                        onChange={(e) => setAjustes({ ...ajustes, oabs: e.target.value })}
                      />
                      <datalist id="g-oabs-opcoes">
                        <option value="por_advogado">1 por advogado</option>
                      </datalist>
                      <p className={dica}>Número fixo ou <code>por_advogado</code>.</p>
                    </>
                  ) : (
                    <input
                      id={id}
                      inputMode="numeric"
                      className={campo}
                      placeholder={`Padrão (${padraoTexto})`}
                      value={ajustes[chave]}
                      onChange={(e) => setAjustes({ ...ajustes, [chave]: e.target.value })}
                    />
                  )}
                </div>
              )
            })}
          </div>
          <p className={`${dica} mt-3`}>
            Buscas automáticas por dia útil passam a valer quando o robô for atualizado para trabalhar por
            organização.
          </p>
        </div>
      </form>
    </Modal>
  )
}
