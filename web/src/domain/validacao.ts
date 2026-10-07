import type { EscopoResumo, PapelMembro } from '../lib/database.types'
import { formatarCNJ, validarCNJ } from './cnj'
import { ehDataISO } from './datas'
import { ORIGEM_MANUAL } from './edicao'

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string }

const falha = (erro: string) => ({ ok: false, erro }) as const

// ---------------------------------------------------------------- monitoramento

export interface FormMonitoramento {
  tipo: 'oab' | 'processo'
  oab: string
  uf: string
  processo: string
  descricao: string
}

export interface NovoMonitoramento {
  tipo: 'oab' | 'processo'
  oab_numero: string | null
  oab_uf: string | null
  numero_processo: string | null
  descricao: string | null
}

export function validarMonitoramento(
  form: FormMonitoramento,
  existentes: readonly NovoMonitoramento[] = [],
): Resultado<NovoMonitoramento> {
  const descricao = form.descricao.trim() || null
  if (form.tipo === 'oab') {
    const numero = form.oab.replace(/\D/g, '')
    if (!numero) return falha('Informe o número da OAB.')
    if (numero.length > 8) return falha('O número da OAB tem no máximo 8 dígitos.')
    const uf = form.uf.toUpperCase()
    if (!(UFS as readonly string[]).includes(uf)) return falha('Escolha a UF da OAB.')
    if (existentes.some((m) => m.tipo === 'oab' && m.oab_numero === numero && m.oab_uf === uf)) {
      return falha(`A OAB ${numero}/${uf} já está cadastrada.`)
    }
    return {
      ok: true,
      valor: { tipo: 'oab', oab_numero: numero, oab_uf: uf, numero_processo: null, descricao },
    }
  }
  const digitos = form.processo.replace(/\D/g, '')
  if (!validarCNJ(digitos)) {
    return falha('O número do processo deve ter 20 dígitos (padrão CNJ).')
  }
  const numero = formatarCNJ(digitos)
  if (existentes.some((m) => m.tipo === 'processo' && m.numero_processo === numero)) {
    return falha('Este processo já está cadastrado.')
  }
  return {
    ok: true,
    valor: { tipo: 'processo', oab_numero: null, oab_uf: null, numero_processo: numero, descricao },
  }
}

// ---------------------------------------------------------------- feriados

export interface NovoFeriado {
  data: string
  descricao: string
}

export function validarFeriado(
  form: NovoFeriado,
  existentes: readonly string[],
): Resultado<NovoFeriado> {
  if (!ehDataISO(form.data)) return falha('Informe uma data válida.')
  const descricao = form.descricao.trim()
  if (!descricao) return falha('Descreva o feriado ou a suspensão.')
  if (existentes.includes(form.data)) return falha('Já existe um feriado cadastrado nessa data.')
  return { ok: true, valor: { data: form.data, descricao } }
}

// ---------------------------------------------------------------- prazo manual

export interface FormPrazoManual {
  processo: string
  tribunal: string
  tipo: string
  inicio: string
  dias: string
  vencimento: string
  observacoes: string
}

export interface NovoPrazoManual {
  processo: string
  tribunal: string | null
  tipo: string
  inicio_prazo: string | null
  prazo_dias: number | null
  vencimento: string
  observacoes: string | null
  origem_prazo: string
  status: 'pendente'
}

export function lerDias(valor: string): number | null {
  const texto = valor.trim()
  if (!texto) return null
  const numero = Number(texto)
  return Number.isInteger(numero) ? numero : Number.NaN
}

export function validarPrazoManual(form: FormPrazoManual): Resultado<NovoPrazoManual> {
  if (!validarCNJ(form.processo.replace(/\D/g, ''))) {
    return falha('O número do processo deve ter 20 dígitos (padrão CNJ).')
  }
  const dias = lerDias(form.dias)
  if (dias !== null && (Number.isNaN(dias) || dias < 1 || dias > 365)) {
    return falha('O prazo deve ter entre 1 e 365 dias.')
  }
  if (form.inicio && !ehDataISO(form.inicio)) return falha('Informe um início do prazo válido.')
  if (!ehDataISO(form.vencimento)) return falha('Informe a data de vencimento.')
  if (form.inicio && form.vencimento < form.inicio) {
    return falha('O vencimento não pode ser anterior ao início do prazo.')
  }
  return {
    ok: true,
    valor: {
      processo: formatarCNJ(form.processo.replace(/\D/g, '')),
      tribunal: form.tribunal.trim().toUpperCase() || null,
      tipo: form.tipo.trim() || 'Prazo manual',
      inicio_prazo: form.inicio || null,
      prazo_dias: dias,
      vencimento: form.vencimento,
      observacoes: form.observacoes.trim() || null,
      origem_prazo: ORIGEM_MANUAL,
      status: 'pendente',
    },
  }
}

// ---------------------------------------------------------------- configurações

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function inteiroEntre(valor: string, minimo: number, maximo: number): number | null {
  const numero = Number(valor.trim())
  if (!valor.trim() || !Number.isInteger(numero) || numero < minimo || numero > maximo) return null
  return numero
}

/** Configuração pessoal: para onde vai o resumo, quantos dias à frente e de quais prazos. */
export interface FormConfiguracaoPessoal {
  email_destino: string
  dias_alerta: string
  resumo_escopo: EscopoResumo
}

export interface ConfiguracaoPessoalValida {
  email_destino: string
  dias_alerta: number
  resumo_escopo: EscopoResumo
}

export function validarConfiguracaoPessoal(form: FormConfiguracaoPessoal): Resultado<ConfiguracaoPessoalValida> {
  const email = form.email_destino.trim()
  if (!EMAIL_VALIDO.test(email)) return falha('Informe um e-mail válido para os alertas.')
  const alerta = inteiroEntre(form.dias_alerta, 1, 60)
  if (alerta === null) return falha('Janela de alerta: use um número entre 1 e 60.')
  return { ok: true, valor: { email_destino: email, dias_alerta: alerta, resumo_escopo: form.resumo_escopo } }
}

/** Configuração do robô para a organização inteira (só o Administrador). */
export interface FormConfiguracaoOrganizacao {
  dias_retroativos: string
  prazo_padrao_dias: string
  considerar_recesso: boolean
  webhook_token: string
}

export interface ConfiguracaoOrganizacaoValida {
  dias_retroativos: number
  prazo_padrao_dias: number
  considerar_recesso: boolean
  webhook_token: string
}

export function validarConfiguracaoOrganizacao(
  form: FormConfiguracaoOrganizacao,
): Resultado<ConfiguracaoOrganizacaoValida> {
  const retroativos = inteiroEntre(form.dias_retroativos, 1, 30)
  if (retroativos === null) return falha('Dias para trás: use um número entre 1 e 30.')
  const padrao = inteiroEntre(form.prazo_padrao_dias, 1, 365)
  if (padrao === null) return falha('Prazo padrão: use um número entre 1 e 365.')
  if (!/^[A-Za-z0-9]{16,}$/.test(form.webhook_token)) {
    return falha('Gere um novo token de segurança.')
  }
  return {
    ok: true,
    valor: {
      dias_retroativos: retroativos,
      prazo_padrao_dias: padrao,
      considerar_recesso: form.considerar_recesso,
      webhook_token: form.webhook_token,
    },
  }
}

// ---------------------------------------------------------------- equipe

export interface NovoConvite {
  email: string
  papel: PapelMembro
}

/** Confere antes de mandar ao banco (que repete tudo, inclusive as vagas do plano). */
export function validarConvite(
  form: NovoConvite,
  emailsDaEquipe: readonly string[],
  emailsConvidados: readonly string[],
): Resultado<NovoConvite> {
  const email = form.email.trim().toLowerCase()
  if (!EMAIL_VALIDO.test(email)) return falha('Informe um e-mail válido.')
  if (emailsDaEquipe.some((e) => e.toLowerCase() === email)) return falha('Essa pessoa já faz parte da equipe.')
  if (emailsConvidados.some((e) => e.toLowerCase() === email)) {
    return falha('Já existe um convite para esse e-mail: reenvie ou cancele o atual.')
  }
  return { ok: true, valor: { email, papel: form.papel } }
}

// ---------------------------------------------------------------- painel dev

/** URL do webhook do n8n (configuração do sistema). Vazia desliga o "Buscar agora". */
export function validarUrlWebhook(url: string): Resultado<string> {
  const valor = url.trim()
  if (valor && !/^https?:\/\/\S+$/i.test(valor)) {
    return falha('A URL do webhook deve começar com http:// ou https://.')
  }
  return { ok: true, valor }
}

export function validarNovaSenha(senha: string): Resultado<string> {
  if (senha.length < 8) return falha('A senha precisa ter pelo menos 8 caracteres.')
  return { ok: true, valor: senha }
}

export interface FormNovaConta {
  email: string
  senha: string
  papel: 'dev' | 'advogado'
}

export function validarNovaConta(
  form: FormNovaConta,
  emailsExistentes: readonly string[],
): Resultado<FormNovaConta> {
  const email = form.email.trim().toLowerCase()
  if (!EMAIL_VALIDO.test(email)) return falha('Informe um e-mail válido.')
  if (emailsExistentes.some((e) => e.toLowerCase() === email)) {
    return falha('Já existe uma conta com esse e-mail.')
  }
  const senha = validarNovaSenha(form.senha)
  if (!senha.ok) return senha
  return { ok: true, valor: { email, senha: form.senha, papel: form.papel } }
}
