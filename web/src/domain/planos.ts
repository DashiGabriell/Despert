import type { Json, Plano, SituacaoOrganizacao } from '../lib/database.types'
import { hojeISO } from './datas'
import type { DataISO } from './dias'
import type { Resultado } from './validacao'

/** OABs: número fixo ou uma por membro que advoga (Administrador e Advogado). */
export type LimiteOabs = number | 'por_advogado'

/** Limites de uso de uma organização (ADR-0008). As chaves são as mesmas do banco. */
export interface Limites {
  usuarios: number
  oabs: LimiteOabs
  processos: number
  buscas_automaticas: number
  intervalo_busca_min: number
  buscas_agora_dia: number
  papeis: boolean
  auditoria: boolean
}

export type AjustesLimites = Partial<Limites>

// Espelho de public.limites_padrao() em supabase/schema.sql: mudar um exige mudar o outro.
export const LIMITES_PADRAO: Record<Plano, Limites> = {
  solo: {
    usuarios: 1,
    oabs: 1,
    processos: 10,
    buscas_automaticas: 1,
    intervalo_busca_min: 30,
    buscas_agora_dia: 1,
    papeis: false,
    auditoria: false,
  },
  escritorio: {
    usuarios: 10,
    oabs: 'por_advogado',
    processos: 50,
    buscas_automaticas: 2,
    intervalo_busca_min: 10,
    buscas_agora_dia: 15,
    papeis: true,
    auditoria: true,
  },
  corporativo: {
    usuarios: 20,
    oabs: 'por_advogado',
    processos: 70,
    buscas_automaticas: 2,
    intervalo_busca_min: 10,
    buscas_agora_dia: 20,
    papeis: true,
    auditoria: true,
  },
}

export const ROTULO_PLANO: Record<Plano, string> = {
  solo: 'Solo',
  escritorio: 'Escritório',
  corporativo: 'Corporativo',
}

export const PLANOS: readonly Plano[] = ['solo', 'escritorio', 'corporativo']

/** Faixa aceita para cada limite numérico (a mesma do banco). */
type LimiteNumerico = Exclude<keyof Limites, 'papeis' | 'auditoria'>

export const FAIXAS: Record<LimiteNumerico, [number, number]> = {
  usuarios: [1, 500],
  oabs: [0, 500],
  processos: [0, 5000],
  buscas_automaticas: [1, 2],
  intervalo_busca_min: [1, 1440],
  buscas_agora_dia: [0, 500],
}

function inteiroNaFaixa(valor: unknown, [min, max]: [number, number]): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= min && valor <= max
}

/** Lê os ajustes gravados no banco, descartando chaves desconhecidas ou valores inválidos. */
export function lerAjustes(bruto: Json | undefined): AjustesLimites {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return {}
  const ajustes: AjustesLimites = {}
  for (const chave of ['usuarios', 'processos', 'buscas_automaticas', 'intervalo_busca_min', 'buscas_agora_dia'] as const) {
    const valor = bruto[chave]
    if (inteiroNaFaixa(valor, FAIXAS[chave])) ajustes[chave] = valor
  }
  if (bruto.oabs === 'por_advogado' || inteiroNaFaixa(bruto.oabs, FAIXAS.oabs)) ajustes.oabs = bruto.oabs
  if (typeof bruto.papeis === 'boolean') ajustes.papeis = bruto.papeis
  if (typeof bruto.auditoria === 'boolean') ajustes.auditoria = bruto.auditoria
  return ajustes
}

/** Limites que valem para a organização: o padrão do plano sobrescrito pelos ajustes do dev. */
export function limitesEfetivos(plano: Plano, ajustes: Json | undefined): Limites {
  return { ...LIMITES_PADRAO[plano], ...lerAjustes(ajustes) }
}

/** Formulário de ajustes do painel dev: texto vazio = usa o padrão do plano. */
export type CamposAjustes = Record<keyof Limites, string>

export const CHAVES_LIMITES: readonly (keyof Limites)[] = [
  'usuarios',
  'oabs',
  'processos',
  'buscas_automaticas',
  'intervalo_busca_min',
  'buscas_agora_dia',
  'papeis',
  'auditoria',
]

export function camposDosAjustes(bruto: Json | undefined): CamposAjustes {
  const ajustes = lerAjustes(bruto)
  const campos = {} as CamposAjustes
  for (const chave of CHAVES_LIMITES) {
    const valor = ajustes[chave]
    campos[chave] = valor === undefined ? '' : typeof valor === 'boolean' ? (valor ? 'sim' : 'nao') : String(valor)
  }
  return campos
}

export function validarAjustes(campos: CamposAjustes): Resultado<AjustesLimites> {
  const ajustes: AjustesLimites = {}
  for (const chave of CHAVES_LIMITES) {
    const texto = campos[chave].trim()
    if (!texto) continue
    if (chave === 'papeis' || chave === 'auditoria') {
      if (texto !== 'sim' && texto !== 'nao') return { ok: false, erro: `Valor inválido em ${ROTULO_LIMITE[chave]}.` }
      ajustes[chave] = texto === 'sim'
      continue
    }
    if (chave === 'oabs' && texto === 'por_advogado') {
      ajustes.oabs = 'por_advogado'
      continue
    }
    const numero = Number(texto)
    const [min, max] = FAIXAS[chave]
    if (!inteiroNaFaixa(numero, FAIXAS[chave])) {
      return { ok: false, erro: `${ROTULO_LIMITE[chave]}: use um número inteiro de ${min} a ${max}.` }
    }
    ajustes[chave] = numero
  }
  return { ok: true, valor: ajustes }
}

export const ROTULO_LIMITE: Record<keyof Limites, string> = {
  usuarios: 'Usuários',
  oabs: 'OABs monitoradas',
  processos: 'Processos avulsos',
  buscas_automaticas: 'Buscas automáticas por dia útil',
  intervalo_busca_min: 'Intervalo do Buscar agora (min)',
  buscas_agora_dia: 'Buscar agora por dia',
  papeis: 'Papéis além do Administrador',
  auditoria: 'Auditoria e exportação',
}

/** Texto curto de um limite (`1 por advogado`, `sim`, `30`). */
export function descreverLimite(valor: Limites[keyof Limites]): string {
  if (valor === 'por_advogado') return '1 por advogado'
  if (typeof valor === 'boolean') return valor ? 'sim' : 'não'
  return String(valor)
}

// ------------------------------------------------------------------ quantidades

export type Recurso = 'usuarios' | 'oabs' | 'processos'

export interface Uso {
  usuarios: number
  oabs: number
  processos: number
  /** Membros que advogam (Administrador e Advogado): base do limite "1 OAB por advogado". */
  advogados: number
}

export function limiteDe(recurso: Recurso, limites: Limites, advogados: number): number {
  if (recurso !== 'oabs') return limites[recurso]
  return limites.oabs === 'por_advogado' ? advogados : limites.oabs
}

export type SituacaoLimite = 'livre' | 'perto' | 'cheio' | 'excedido'

/** `perto` a partir de 80% do limite, para avisar antes de travar. */
export function situacaoDoLimite(usados: number, limite: number): SituacaoLimite {
  if (usados > limite) return 'excedido'
  if (usados === limite) return 'cheio'
  if (usados >= limite * 0.8) return 'perto'
  return 'livre'
}

export function podeAdicionar(recurso: Recurso, limites: Limites, uso: Uso): boolean {
  return uso[recurso] < limiteDe(recurso, limites, uso.advogados)
}

/** Recursos acima do limite (ex.: depois de o dev trocar para um plano menor). */
export function excessos(limites: Limites, uso: Uso): Recurso[] {
  return (['usuarios', 'oabs', 'processos'] as const).filter(
    (r) => uso[r] > limiteDe(r, limites, uso.advogados),
  )
}

// ------------------------------------------------------------------ teste e carência

export type Etapa = 'teste' | 'ativa' | 'aviso' | 'leitura' | 'suspensa'

/** Duração do teste e das etapas da carência, em dias (configuráveis pelo dev). */
export interface Carencia {
  dias_teste: number
  carencia_aviso_dias: number
  carencia_total_dias: number
}

export const CARENCIA_PADRAO: Carencia = { dias_teste: 7, carencia_aviso_dias: 5, carencia_total_dias: 15 }

export function validarCarencia(form: Record<keyof Carencia, string>): Resultado<Carencia> {
  const faixas: Record<keyof Carencia, [number, number, string]> = {
    dias_teste: [1, 90, 'Dias de teste'],
    carencia_aviso_dias: [0, 60, 'Dias de aviso'],
    carencia_total_dias: [0, 120, 'Carência total'],
  }
  const valor = {} as Carencia
  for (const chave of Object.keys(faixas) as (keyof Carencia)[]) {
    const [min, max, nome] = faixas[chave]
    const numero = Number(form[chave].trim())
    if (!form[chave].trim() || !inteiroNaFaixa(numero, [min, max])) {
      return { ok: false, erro: `${nome}: use um número inteiro de ${min} a ${max}.` }
    }
    valor[chave] = numero
  }
  if (valor.carencia_aviso_dias > valor.carencia_total_dias) {
    return { ok: false, erro: 'Os dias de aviso não podem passar da carência total.' }
  }
  return { ok: true, valor }
}

/** Dias configurados pelo dev, ou o padrão enquanto a configuração do sistema carrega. */
export function carenciaDe(sistema: Partial<Carencia> | null | undefined): Carencia {
  return {
    dias_teste: sistema?.dias_teste ?? CARENCIA_PADRAO.dias_teste,
    carencia_aviso_dias: sistema?.carencia_aviso_dias ?? CARENCIA_PADRAO.carencia_aviso_dias,
    carencia_total_dias: sistema?.carencia_total_dias ?? CARENCIA_PADRAO.carencia_total_dias,
  }
}

/**
 * Novo "pago até" ao registrar um pagamento de `meses`: soma a partir do vencimento atual se
 * ele ainda não passou, senão a partir de hoje. O dia do mês é mantido (31/01 + 1 → 28/02).
 */
export function estenderPagamento(pagoAte: DataISO | null, hoje: DataISO, meses: number): DataISO {
  const base = pagoAte && pagoAte >= hoje ? pagoAte : hoje
  const [ano, mes, dia] = base.split('-').map(Number)
  const indice = ano * 12 + (mes - 1) + meses
  const novoAno = Math.floor(indice / 12)
  const novoMes = (indice % 12) + 1
  const ultimoDia = new Date(Date.UTC(novoAno, novoMes, 0)).getUTCDate()
  return `${novoAno}-${String(novoMes).padStart(2, '0')}-${String(Math.min(dia, ultimoDia)).padStart(2, '0')}`
}

export interface DadosDeAcesso {
  situacao: SituacaoOrganizacao
  teste_iniciado_em: string | null
  criado_em: string
  pago_ate: DataISO | null
}

function diasEntre(de: DataISO, ate: DataISO): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000)
}

/** Último dia de acesso pleno, ou `null` quando não há vencimento. */
export function ultimoDiaDeAcesso(org: DadosDeAcesso, carencia: Carencia): DataISO | null {
  if (org.situacao === 'ativa') return org.pago_ate
  const inicio = hojeISO(new Date(org.teste_iniciado_em ?? org.criado_em))
  const fim = new Date(`${inicio}T00:00:00Z`)
  fim.setUTCDate(fim.getUTCDate() + carencia.dias_teste - 1)
  return fim.toISOString().slice(0, 10)
}

/** Dia da carência (1 = primeiro dia depois do vencimento); 0 quando o acesso está em dia. */
export function diaDaCarencia(org: DadosDeAcesso, hoje: DataISO, carencia: Carencia): number {
  const fim = ultimoDiaDeAcesso(org, carencia)
  if (!fim) return 0
  return Math.max(0, diasEntre(fim, hoje))
}

// Espelho de public.etapa_de() em supabase/schema.sql.
export function etapaDaOrganizacao(org: DadosDeAcesso, hoje: DataISO, carencia: Carencia): Etapa {
  const dia = diaDaCarencia(org, hoje, carencia)
  if (dia === 0) return org.situacao
  if (dia <= carencia.carencia_aviso_dias) return 'aviso'
  if (dia <= carencia.carencia_total_dias) return 'leitura'
  return 'suspensa'
}

/** Somente leitura e suspensa não aceitam alterações dos membros (o robô segue até o fim da carência). */
export function permiteEscrita(etapa: Etapa): boolean {
  return etapa !== 'leitura' && etapa !== 'suspensa'
}

/** Dias até a próxima mudança de etapa (fim do teste, ou início do somente leitura), ou `null`. */
export function diasAteMudar(org: DadosDeAcesso, hoje: DataISO, carencia: Carencia): number | null {
  const fim = ultimoDiaDeAcesso(org, carencia)
  if (!fim) return null
  const dia = diaDaCarencia(org, hoje, carencia)
  if (dia === 0) return diasEntre(hoje, fim) + 1
  if (dia <= carencia.carencia_aviso_dias) return carencia.carencia_aviso_dias - dia + 1
  if (dia <= carencia.carencia_total_dias) return carencia.carencia_total_dias - dia + 1
  return null
}

// ------------------------------------------------------------------ Buscar agora

/** Disparos de hoje (dia de Brasília, zera à meia-noite) e o mais recente da organização. */
export function resumoBuscasAgora(
  buscas: readonly { criado_em: string }[],
  agora: number,
): { hoje: number; ultima: string | null } {
  const dia = hojeISO(new Date(agora))
  let ultima: string | null = null
  let hoje = 0
  for (const b of buscas) {
    if (hojeISO(new Date(b.criado_em)) === dia) hoje++
    if (!ultima || Date.parse(b.criado_em) > Date.parse(ultima)) ultima = b.criado_em
  }
  return { hoje, ultima }
}

export function buscasAgoraRestantes(limites: Limites, usadasHoje: number): number {
  return Math.max(0, limites.buscas_agora_dia - usadasHoje)
}
