import type { Urgencia } from '../domain/urgencia'

export const botao = 'ds-btn ds-btn-secondary'
export const botaoPequeno = 'ds-btn ds-btn-secondary ds-btn-sm'
export const botaoPrimario = 'ds-btn ds-btn-primary'
export const botaoDourado = 'ds-btn ds-btn-coin'
export const botaoSucesso = 'ds-btn ds-btn-success'
export const botaoSucessoPequeno = 'ds-btn ds-btn-success ds-btn-sm'
export const botaoPerigo = 'ds-btn ds-btn-ghost ds-btn-perigo'
export const botaoPerigoPequeno = 'ds-btn ds-btn-ghost ds-btn-perigo ds-btn-sm'
export const botaoPerigoForte = 'ds-btn ds-btn-destructive'

export const campo = 'ds-input'
export const rotulo = 'ds-label'
export const dica = 'ds-hint'
export const cartao = 'ds-card'
export const separador = 'mb-3 mt-1 text-xs font-bold tracking-wider text-muted uppercase'

export const tabela = 'ds-table'
export const vazioTabela = 'px-6 py-10 text-center text-muted'

export const alertaErro = 'ds-alert ds-alert-destructive'
export const alertaAviso = 'ds-alert ds-alert-warning'
export const alertaOk = 'ds-alert ds-alert-success'

export const CORES_URGENCIA: Record<Urgencia, string> = {
  vencido: 'ds-badge-destructive',
  hoje: 'ds-badge-solido',
  urgente: 'ds-badge-warning',
  proximo: 'ds-badge-coin',
  futuro: 'ds-badge-success',
  fechado: 'ds-badge-secondary',
  semdata: 'ds-badge-navy',
}
