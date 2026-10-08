import { useState, type ReactNode } from 'react'
import { formatarData, formatarDataHora } from '../domain/datas'
import type { DataISO, OpcoesDias } from '../domain/dias'
import { montarAtualizacao, recalcularVencimento, type AtualizacaoPrazo } from '../domain/edicao'
import { nomeDoMembro } from '../domain/equipe'
import { ROTULO_STATUS } from '../domain/selo'
import { emAberto, precisaConferir, type StatusPrazo } from '../domain/urgencia'
import { lerDias } from '../domain/validacao'
import { mensagemDeErro } from '../lib/toast-context'
import type { MembroDaEquipe, Prazo } from '../lib/database.types'
import Modal from './Modal'
import SeloPrazo from './SeloPrazo'
import {
  alertaAviso,
  alertaErro,
  botao,
  botaoPerigo,
  botaoPerigoForte,
  botaoPrimario,
  botaoSucesso,
  campo,
  dica,
  rotulo,
  separador,
} from './ui'

/** O que o papel (e a etapa do plano) deixa fazer neste prazo. */
export interface PermissoesPrazo {
  editar: boolean
  cumprir: boolean
  excluir: boolean
  trocarResponsavel: boolean
}

const TODAS: PermissoesPrazo = { editar: true, cumprir: true, excluir: true, trocarResponsavel: true }

export type SalvarPrazo = AtualizacaoPrazo & { responsavel_id?: string | null }

interface Props {
  prazo: Prazo
  hoje: DataISO
  opcoesDias: OpcoesDias
  permissoes?: PermissoesPrazo
  /** Equipe para escolher o responsável; sem ela (Solo) o campo não aparece. */
  membros?: readonly MembroDaEquipe[]
  eu?: string
  /** Histórico de alterações (só nos planos com auditoria). */
  alteracoes?: ReactNode
  onSalvar: (dados: SalvarPrazo) => Promise<void>
  onExcluir: () => Promise<void>
  onFechar: () => void
}

function Info({ titulo, children, largo }: { titulo: string; children: ReactNode; largo?: boolean }) {
  return (
    <div className={largo ? 'sm:col-span-3' : undefined}>
      <span className="block text-[11px] font-semibold tracking-wide text-muted uppercase">{titulo}</span>
      {children || '—'}
    </div>
  )
}

export default function ModalPrazo({
  prazo,
  hoje,
  opcoesDias,
  permissoes = TODAS,
  membros,
  eu,
  alteracoes,
  onSalvar,
  onExcluir,
  onFechar,
}: Props) {
  const [responsavel, setResponsavel] = useState(prazo.responsavel_id ?? '')
  const [status, setStatus] = useState<StatusPrazo>(prazo.status)
  const [inicio, setInicio] = useState(prazo.inicio_prazo ?? '')
  const [dias, setDias] = useState(prazo.prazo_dias ? String(prazo.prazo_dias) : '')
  const [vencimento, setVencimento] = useState(prazo.vencimento ?? '')
  const [observacoes, setObservacoes] = useState(prazo.observacoes ?? '')
  const [recalculado, setRecalculado] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function recalcular(novoInicio: string, novosDias: string) {
    const calculado = recalcularVencimento(novoInicio, lerDias(novosDias), opcoesDias)
    if (calculado) {
      setVencimento(calculado)
      setRecalculado(true)
    }
  }

  async function executar(acao: () => Promise<void>) {
    setOcupado(true)
    setErro(null)
    try {
      await acao()
    } catch (e) {
      setErro(mensagemDeErro(e))
      setOcupado(false)
    }
  }

  function salvar(statusFinal: StatusPrazo) {
    const diasNumero = lerDias(dias)
    if (diasNumero !== null && (Number.isNaN(diasNumero) || diasNumero < 1 || diasNumero > 365)) {
      setErro('O prazo deve ter entre 1 e 365 dias.')
      return
    }
    const dados: SalvarPrazo = montarAtualizacao(
      prazo,
      { status: statusFinal, vencimento, prazo_dias: diasNumero, inicio_prazo: inicio, observacoes },
      new Date().toISOString(),
    )
    if (membros && responsavel && responsavel !== prazo.responsavel_id) dados.responsavel_id = responsavel
    void executar(() => onSalvar(dados))
  }

  const podeSalvar = permissoes.editar || (Boolean(membros) && permissoes.trocarResponsavel)
  const rodape = !podeSalvar && !permissoes.cumprir && !permissoes.excluir ? (
    <button type="button" className={botao} onClick={onFechar}>
      Fechar
    </button>
  ) : confirmandoExclusao ? (
    <>
      <span className="mr-auto self-center text-sm text-danger">
        Excluir este prazo? Se a publicação ainda estiver no período de busca, o robô vai capturá-la de novo.
      </span>
      <button type="button" className={botao} onClick={() => setConfirmandoExclusao(false)}>
        Cancelar
      </button>
      <button
        type="button"
        className={botaoPerigoForte}
        disabled={ocupado}
        onClick={() => void executar(onExcluir)}
      >
        Confirmar exclusão
      </button>
    </>
  ) : (
    <>
      {permissoes.excluir && (
        <button
          type="button"
          className={`${botaoPerigo} mr-auto`}
          onClick={() => setConfirmandoExclusao(true)}
        >
          Excluir
        </button>
      )}
      <button type="button" className={`${botao} ${permissoes.excluir ? '' : 'mr-auto'}`} onClick={onFechar}>
        Cancelar
      </button>
      {emAberto(prazo) && permissoes.cumprir && (
        <button
          type="button"
          className={botaoSucesso}
          disabled={ocupado}
          onClick={() => salvar('cumprido')}
        >
          Marcar cumprido
        </button>
      )}
      {podeSalvar && (
        <button type="button" className={botaoPrimario} disabled={ocupado} onClick={() => salvar(status)}>
          Salvar
        </button>
      )}
    </>
  )

  return (
    <Modal
      titulo={<span className="font-mono">{prazo.processo || 'Sem número'}</span>}
      subtitulo={
        <>
          <SeloPrazo prazo={prazo} hoje={hoje} />
          <span className="text-muted">{prazo.tipo}</span>
        </>
      }
      onFechar={onFechar}
      rodape={rodape}
    >
      {precisaConferir(prazo) && (
        <div className={`${alertaAviso} mb-4`}>
          <strong>Para conferir:</strong> o robô não identificou o prazo com segurança no texto. Confira a
          publicação e ajuste os dias ou mude o status para Pendente.
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-x-5 gap-y-3 text-sm sm:grid-cols-3">
        <Info titulo="Tribunal">{prazo.tribunal}</Info>
        <Info titulo="Órgão">{prazo.orgao}</Info>
        <Info titulo="Classe">{prazo.classe}</Info>
        <Info titulo="Disponibilização">{formatarData(prazo.data_disponibilizacao)}</Info>
        <Info titulo="Publicação">{formatarData(prazo.data_publicacao)}</Info>
        <Info titulo="Início do prazo">{formatarData(prazo.inicio_prazo)}</Info>
        <Info titulo="Vencimento">{formatarData(prazo.vencimento)}</Info>
        <Info titulo="Prazo">{prazo.prazo_dias ? `${prazo.prazo_dias} dias úteis` : null}</Info>
        <Info titulo="Origem do prazo">{prazo.origem_prazo}</Info>
        {prazo.cumprido_em && <Info titulo="Cumprido em">{formatarDataHora(prazo.cumprido_em)}</Info>}
        <Info titulo="Partes intimadas" largo>
          {prazo.partes}
        </Info>
      </div>

      {prazo.teor && (
        <>
          <div className={separador}>Teor da publicação</div>
          <div className="mb-3 max-h-64 overflow-auto rounded-xl border border-line bg-secondary/60 p-3.5 text-[13px] leading-relaxed whitespace-pre-wrap">
            {prazo.teor}
          </div>
        </>
      )}
      {prazo.link && (
        <p className="mb-5 text-sm">
          <a href={prazo.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-2">
            Abrir documento no tribunal ↗
          </a>
        </p>
      )}

      <div className={separador}>Controle</div>
      {membros && (
        <div className="mb-3.5 sm:max-w-xs">
          <label className={rotulo} htmlFor="e-responsavel">
            Responsável
          </label>
          <select
            id="e-responsavel"
            className={campo}
            value={responsavel}
            disabled={!permissoes.trocarResponsavel}
            onChange={(e) => setResponsavel(e.target.value)}
          >
            {!membros.some((m) => m.user_id === responsavel) && (
              <option value={responsavel}>{responsavel ? 'Fora da equipe' : 'Sem responsável'}</option>
            )}
            {membros.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {nomeDoMembro(m, eu)}
              </option>
            ))}
          </select>
          {prazo.tambem_intimados.length > 0 && (
            <p className="mt-1.5 text-sm text-muted">
              Também intimados:{' '}
              {prazo.tambem_intimados
                .map((id) => {
                  const membro = membros.find((m) => m.user_id === id)
                  return membro ? nomeDoMembro(membro, eu) : 'ex-membro da equipe'
                })
                .join(', ')}
            </p>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-4">
        <div>
          <label className={rotulo} htmlFor="e-inicio">
            Início do prazo
          </label>
          <input
            id="e-inicio"
            type="date"
            className={campo}
            disabled={!permissoes.editar}
            value={inicio}
            onChange={(e) => {
              setInicio(e.target.value)
              recalcular(e.target.value, dias)
            }}
          />
        </div>
        <div>
          <label className={rotulo} htmlFor="e-dias">
            Prazo (dias úteis)
          </label>
          <input
            id="e-dias"
            type="number"
            min={1}
            max={365}
            className={campo}
            disabled={!permissoes.editar}
            value={dias}
            onChange={(e) => {
              setDias(e.target.value)
              recalcular(inicio, e.target.value)
            }}
          />
        </div>
        <div>
          <label className={rotulo} htmlFor="e-venc">
            Vencimento
          </label>
          <input
            id="e-venc"
            type="date"
            className={campo}
            disabled={!permissoes.editar}
            value={vencimento}
            onChange={(e) => {
              setVencimento(e.target.value)
              setRecalculado(false)
            }}
          />
        </div>
        <div>
          <label className={rotulo} htmlFor="e-status">
            Status
          </label>
          <select
            id="e-status"
            className={campo}
            disabled={!permissoes.editar}
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusPrazo)}
          >
            {Object.entries(ROTULO_STATUS).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className={`${dica} mb-3.5`}>
        {recalculado
          ? `Vencimento recalculado em dias úteis: ${formatarData(vencimento)}.`
          : 'Ao mudar o início ou os dias, o vencimento é recalculado em dias úteis (feriados e recesso considerados).'}
      </p>
      <div>
        <label className={rotulo} htmlFor="e-obs">
          Observações
        </label>
        <textarea
          id="e-obs"
          rows={3}
          className={campo}
          disabled={!permissoes.editar}
          placeholder="Anotações internas sobre este prazo…"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
        />
      </div>
      {alteracoes}
      {erro && <div className={`${alertaErro} mt-4`}>{erro}</div>}
    </Modal>
  )
}
