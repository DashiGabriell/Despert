import type { Json, Papel } from '../lib/database.types'

export const BASE_DEV = '/dashitecnology'

export const MODOS_DEV = [
  { modo: 'visao-geral', rotulo: 'Visão geral' },
  { modo: 'usuarios', rotulo: 'Usuários' },
  { modo: 'organizacoes', rotulo: 'Organizações' },
  { modo: 'dados', rotulo: 'Dados' },
  { modo: 'execucoes', rotulo: 'Execuções' },
  { modo: 'n8n', rotulo: 'n8n' },
  { modo: 'auditoria', rotulo: 'Auditoria' },
] as const

export type ModoDev = (typeof MODOS_DEV)[number]['modo']

/** Advogado que o dev está representando no "entrar como advogado". */
export interface Atuacao {
  userId: string
  email: string
}

/** Papel vindo do `app_metadata` da sessão. Só a interface usa: o banco confere de novo. */
export function papelDe(usuario: { app_metadata?: Record<string, unknown> } | null | undefined): Papel {
  return usuario?.app_metadata?.app_role === 'dev' ? 'dev' : 'advogado'
}

export function ehModoDev(modo: string | undefined): modo is ModoDev {
  return MODOS_DEV.some((m) => m.modo === modo)
}

export function rotaDev(modo: ModoDev = 'visao-geral'): string {
  return `${BASE_DEV}/${modo}`
}

export function rotuloModoDev(modo: ModoDev): string {
  return MODOS_DEV.find((m) => m.modo === modo)!.rotulo
}

/** Para onde mandar quem acabou de entrar: o dev vai ao painel, a menos que esteja atuando. */
export function rotaInicial(papel: Papel, atuando: boolean): string {
  return papel === 'dev' && !atuando ? rotaDev() : '/prazos'
}

/** Lê a atuação salva na aba; descarta qualquer coisa malformada. */
export function lerAtuacao(bruto: string | null): Atuacao | null {
  if (!bruto) return null
  try {
    const valor: unknown = JSON.parse(bruto)
    if (
      valor &&
      typeof valor === 'object' &&
      'userId' in valor &&
      'email' in valor &&
      typeof valor.userId === 'string' &&
      typeof valor.email === 'string' &&
      valor.userId
    ) {
      return { userId: valor.userId, email: valor.email }
    }
  } catch {
    // JSON inválido: trata como sem atuação.
  }
  return null
}

const TABELAS: Record<string, string> = {
  prazos: 'prazo',
  monitoramentos: 'monitoramento',
  feriados: 'feriado',
  feriados_organizacao: 'feriado',
  configuracoes: 'configuração do advogado',
  configuracoes_organizacao: 'configuração da organização',
  convites: 'convite',
  configuracao_sistema: 'configuração do sistema',
  organizacoes: 'organização',
  membros: 'membro',
}

const OPERACOES: Record<string, string> = {
  insert: 'Criou',
  update: 'Alterou',
  delete: 'Excluiu',
}

const ACOES: Record<string, string> = {
  criar_conta: 'Criou conta',
  redefinir_senha: 'Redefiniu senha',
  bloquear: 'Bloqueou conta',
  desbloquear: 'Desbloqueou conta',
  definir_papel: 'Alterou papel',
  excluir_conta: 'Excluiu conta',
  atuar_como: 'Entrou como advogado',
  disparar_busca: 'Disparou busca',
  exportar_prazos: 'Exportou prazos',
  exportar_auditoria: 'Exportou a auditoria',
}

/** Texto legível de uma ação registrada na auditoria (`insert:prazos`, `bloquear`…). */
export function descreverAcao(acao: string): string {
  if (ACOES[acao]) return ACOES[acao]
  const [operacao, tabela] = acao.split(':')
  if (tabela && OPERACOES[operacao]) return `${OPERACOES[operacao]} ${TABELAS[tabela] ?? tabela}`
  return acao
}

const NOMES_CAMPOS: Record<string, string> = {
  n8n_webhook_url: 'URL do webhook',
  webhook_token: 'token',
  ultima_busca_em: 'última busca',
  email_destino: 'e-mail do resumo',
  cumprido_em: 'data de cumprimento',
  pago_ate: 'pago até',
  dias_teste: 'dias de teste',
  carencia_aviso_dias: 'dias de aviso',
  carencia_total_dias: 'carência total',
}

/** Uma linha legível a partir do `detalhe` gravado na auditoria. */
export function resumirDetalhe(detalhe: Json): string {
  if (!detalhe || typeof detalhe !== 'object' || Array.isArray(detalhe)) return ''
  const partes: string[] = []
  if (typeof detalhe.processo === 'string') partes.push(`processo ${detalhe.processo}`)
  if (typeof detalhe.papel === 'string') partes.push(`papel ${detalhe.papel}`)
  if (Array.isArray(detalhe.campos) && detalhe.campos.length > 0) {
    const campos = detalhe.campos.map((c) => NOMES_CAMPOS[String(c)] ?? String(c).replace(/_/g, ' '))
    partes.push(`campos: ${campos.join(', ')}`)
  }
  return partes.join(' · ')
}

export type ResultadoTesteWebhook =
  | { tipo: 'ok'; mensagem: string }
  | { tipo: 'aviso'; mensagem: string }
  | { tipo: 'erro'; mensagem: string }

/** Interpreta o teste de conexão com o webhook do n8n. `status` nulo = resposta ilegível (CORS). */
export function interpretarTesteWebhook(status: number | null): ResultadoTesteWebhook {
  if (status === null) {
    return {
      tipo: 'aviso',
      mensagem:
        'A requisição saiu, mas o navegador não deixou ler a resposta (CORS). Confira no n8n, em Executions, se apareceu uma execução agora.',
    }
  }
  if (status >= 200 && status < 300) {
    return { tipo: 'ok', mensagem: `O n8n respondeu (HTTP ${status}). O webhook está ativo.` }
  }
  if (status === 404) {
    return {
      tipo: 'erro',
      mensagem:
        'HTTP 404: o webhook não existe. O fluxo está inativo ou a URL é a Test URL em vez da Production URL.',
    }
  }
  return { tipo: 'erro', mensagem: `O n8n respondeu com erro (HTTP ${status}).` }
}

/** Busca por e-mail, sem diferenciar maiúsculas. */
export function filtrarContas<T extends { email: string }>(contas: readonly T[], busca: string): T[] {
  const termo = busca.trim().toLowerCase()
  if (!termo) return [...contas]
  return contas.filter((c) => c.email.toLowerCase().includes(termo))
}
