import { useState, type FormEvent } from 'react'
import { formatarData } from '../domain/datas'
import type { OpcoesDias } from '../domain/dias'
import { recalcularVencimento } from '../domain/edicao'
import { lerDias, validarPrazoManual, type NovoPrazoManual } from '../domain/validacao'
import { mensagemDeErro } from '../lib/toast-context'
import Modal from './Modal'
import { alertaErro, botao, botaoPrimario, campo, dica, rotulo } from './ui'

interface Props {
  dataInicial?: string
  opcoesDias: OpcoesDias
  onCriar: (registro: NovoPrazoManual) => Promise<void>
  onFechar: () => void
}

export default function ModalNovoPrazo({ dataInicial, opcoesDias, onCriar, onFechar }: Props) {
  const [form, setForm] = useState({
    processo: '',
    tribunal: '',
    tipo: '',
    inicio: '',
    dias: '',
    vencimento: dataInicial ?? '',
    observacoes: '',
  })
  const [recalculado, setRecalculado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  function alterar(campoAlterado: keyof typeof form, valor: string) {
    const novo = { ...form, [campoAlterado]: valor }
    if (campoAlterado === 'inicio' || campoAlterado === 'dias') {
      const calculado = recalcularVencimento(novo.inicio, lerDias(novo.dias), opcoesDias)
      if (calculado) {
        novo.vencimento = calculado
        setRecalculado(true)
      }
    }
    if (campoAlterado === 'vencimento') setRecalculado(false)
    setForm(novo)
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const resultado = validarPrazoManual(form)
    if (!resultado.ok) {
      setErro(resultado.erro)
      return
    }
    setOcupado(true)
    setErro(null)
    try {
      await onCriar(resultado.valor)
    } catch (falha) {
      setErro(mensagemDeErro(falha))
      setOcupado(false)
    }
  }

  return (
    <Modal titulo="Novo prazo manual" onFechar={onFechar}>
      <form onSubmit={enviar} noValidate>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label className={rotulo} htmlFor="n-proc">
              Processo (CNJ)
            </label>
            <input
              id="n-proc"
              className={`${campo} font-mono`}
              placeholder="0000000-00.0000.0.00.0000"
              value={form.processo}
              onChange={(e) => alterar('processo', e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className={rotulo} htmlFor="n-trib">
              Tribunal
            </label>
            <input
              id="n-trib"
              className={campo}
              placeholder="TJSP"
              value={form.tribunal}
              onChange={(e) => alterar('tribunal', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={rotulo} htmlFor="n-tipo">
              Tipo
            </label>
            <input
              id="n-tipo"
              className={campo}
              placeholder="Contestação, Recurso, Audiência…"
              value={form.tipo}
              onChange={(e) => alterar('tipo', e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <div>
            <label className={rotulo} htmlFor="n-inicio">
              Início do prazo
            </label>
            <input
              id="n-inicio"
              type="date"
              className={campo}
              value={form.inicio}
              onChange={(e) => alterar('inicio', e.target.value)}
            />
          </div>
          <div>
            <label className={rotulo} htmlFor="n-dias">
              Prazo (dias úteis)
            </label>
            <input
              id="n-dias"
              type="number"
              min={1}
              max={365}
              className={campo}
              value={form.dias}
              onChange={(e) => alterar('dias', e.target.value)}
            />
          </div>
          <div>
            <label className={rotulo} htmlFor="n-venc">
              Vencimento
            </label>
            <input
              id="n-venc"
              type="date"
              className={campo}
              value={form.vencimento}
              onChange={(e) => alterar('vencimento', e.target.value)}
            />
          </div>
        </div>
        <p className={dica}>
          {recalculado
            ? `Vencimento calculado em dias úteis: ${formatarData(form.vencimento)}.`
            : 'Preencha início e dias para calcular o vencimento em dias úteis, ou informe o vencimento direto.'}
        </p>
        <div className="mt-3.5">
          <label className={rotulo} htmlFor="n-obs">
            Observações
          </label>
          <textarea
            id="n-obs"
            rows={3}
            className={campo}
            value={form.observacoes}
            onChange={(e) => alterar('observacoes', e.target.value)}
          />
        </div>
        {erro && <div className={`${alertaErro} mt-4`}>{erro}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={botao} onClick={onFechar}>
            Cancelar
          </button>
          <button type="submit" className={botaoPrimario} disabled={ocupado}>
            Criar prazo
          </button>
        </div>
      </form>
    </Modal>
  )
}
