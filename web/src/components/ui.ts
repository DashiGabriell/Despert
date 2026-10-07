import type { Urgencia } from '../domain/urgencia'

const botaoBase =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium whitespace-nowrap transition-colors cursor-pointer disabled:cursor-default disabled:opacity-60'

export const botao = `${botaoBase} border-line bg-white px-3.5 py-2 text-sm text-ink hover:bg-[#f7f8fa]`
export const botaoPequeno = `${botaoBase} border-line bg-white px-2.5 py-1 text-[13px] text-ink hover:bg-[#f7f8fa]`
export const botaoPrimario = `${botaoBase} border-navy bg-navy px-3.5 py-2 text-sm text-white hover:bg-navy-soft`
export const botaoDourado = `${botaoBase} border-gold bg-gold px-3.5 py-2 text-sm text-white hover:brightness-105`
export const botaoSucesso = `${botaoBase} border-ok bg-ok px-3.5 py-2 text-sm text-white hover:bg-[#276b2b]`
export const botaoSucessoPequeno = `${botaoBase} border-ok bg-ok px-2.5 py-1 text-[13px] text-white hover:bg-[#276b2b]`
export const botaoPerigo = `${botaoBase} border-[#f2c4c4] bg-white px-3.5 py-2 text-sm text-danger hover:bg-danger-soft`
export const botaoPerigoPequeno = `${botaoBase} border-[#f2c4c4] bg-white px-2.5 py-1 text-[13px] text-danger hover:bg-danger-soft`

export const campo =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy focus:ring-3 focus:ring-navy/10 disabled:bg-surface'
export const rotulo = 'mb-1 block text-xs font-semibold tracking-wide text-muted uppercase'
export const dica = 'mt-1 text-xs text-muted'
export const cartao = 'rounded-xl border border-line bg-card shadow-sm'
export const separador = 'mb-3 mt-1 text-xs font-bold tracking-wider text-muted uppercase'

export const th =
  'border-b border-line bg-[#fafbfc] px-3.5 py-2.5 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-muted uppercase'
export const td = 'border-b border-line px-3.5 py-3 align-top'

export const alertaErro = 'rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger'
export const alertaAviso = 'rounded-lg bg-caution-soft px-3 py-2.5 text-sm text-[#6b5500]'
export const alertaOk = 'rounded-lg bg-ok-soft px-3 py-2.5 text-sm text-ok'

export const CORES_URGENCIA: Record<Urgencia, string> = {
  vencido: 'bg-danger-soft text-danger',
  hoje: 'bg-danger text-white',
  urgente: 'bg-alert-soft text-alert',
  proximo: 'bg-caution-soft text-caution',
  futuro: 'bg-ok-soft text-ok',
  fechado: 'bg-[#eef0f3] text-muted',
  semdata: 'bg-info-soft text-info',
}
