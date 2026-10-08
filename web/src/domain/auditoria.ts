import type { AlteracaoPrazo, Json, Prazo, RegistroAuditoria } from '../lib/database.types'
import { descreverAcao, resumirDetalhe } from './acesso'
import { gerarCsv } from './csv'
import { formatarData, formatarDataHora } from './datas'
import type { DataISO } from './dias'
import { ROTULO_PAPEL } from './equipe'
import { ROTULO_STATUS } from './selo'

export type CategoriaAuditoria =
  | 'prazos'
  | 'monitoramentos'
  | 'feriados'
  | 'configuracoes'
  | 'equipe'
  | 'exportacoes'
  | 'suporte'

export const CATEGORIAS_AUDITORIA: readonly { valor: CategoriaAuditoria; rotulo: string }[] = [
  { valor: 'prazos', rotulo: 'Prazos' },
  { valor: 'monitoramentos', rotulo: 'Monitoramentos' },
  { valor: 'feriados', rotulo: 'Feriados' },
  { valor: 'configuracoes', rotulo: 'Configurações' },
  { valor: 'equipe', rotulo: 'Equipe' },
  { valor: 'exportacoes', rotulo: 'Exportações' },
  { valor: 'suporte', rotulo: 'Acessos do suporte' },
]

const CATEGORIA_DA_TABELA: Record<string, CategoriaAuditoria> = {
  prazos: 'prazos',
  monitoramentos: 'monitoramentos',
  feriados_organizacao: 'feriados',
  configuracoes: 'configuracoes',
  configuracoes_organizacao: 'configuracoes',
  organizacoes: 'configuracoes',
  membros: 'equipe',
  convites: 'equipe',
}

/** `update:prazos` → prazos; `exportar_*` → exportações; o resto (entrar como, bloquear…) é do suporte. */
export function categoriaDaAcao(acao: string): CategoriaAuditoria {
  const tabela = acao.split(':')[1]
  if (tabela) return CATEGORIA_DA_TABELA[tabela] ?? 'suporte'
  return acao.startsWith('exportar_') ? 'exportacoes' : 'suporte'
}

/** Valor do filtro de autor que junta todas as ações do dev. */
export const AUTOR_SUPORTE = 'suporte'

export function ehDoSuporte(registro: Pick<RegistroAuditoria, 'membro_id'>): boolean {
  return registro.membro_id === null
}

export function rotuloDoAutor(registro: Pick<RegistroAuditoria, 'membro_id' | 'membro_email'>): string {
  if (ehDoSuporte(registro)) return 'Suporte Despert'
  return registro.membro_email ?? 'Ex-membro da equipe'
}

export interface FiltroAuditoria {
  /** Vazio = todos; `AUTOR_SUPORTE` = ações do dev; senão o id do membro. */
  autor: string
  categoria: CategoriaAuditoria | ''
}

export function filtrarAuditoria<T extends Pick<RegistroAuditoria, 'membro_id' | 'acao'>>(
  registros: readonly T[],
  filtro: FiltroAuditoria,
): T[] {
  return registros.filter(
    (r) =>
      (!filtro.autor || (filtro.autor === AUTOR_SUPORTE ? ehDoSuporte(r) : r.membro_id === filtro.autor)) &&
      (!filtro.categoria || categoriaDaAcao(r.acao) === filtro.categoria),
  )
}

/** Período em dias de Brasília (sem horário de verão) → instantes; `ate` entra inteiro. */
export function intervaloDoPeriodo(de: DataISO | '', ate: DataISO | ''): { de?: string; ate?: string } {
  const intervalo: { de?: string; ate?: string } = {}
  if (de) intervalo.de = `${de}T00:00:00-03:00`
  if (ate) intervalo.ate = new Date(Date.parse(`${ate}T00:00:00-03:00`) + 86_400_000).toISOString()
  return intervalo
}

const NOMES_CAMPOS: Record<string, string> = {
  status: 'status',
  vencimento: 'vencimento',
  responsavel_id: 'responsável',
  inicio_prazo: 'início do prazo',
  prazo_dias: 'dias do prazo',
  observacoes: 'observações',
  cumprido_em: 'cumprido em',
  ativo: 'ativo',
  papel: 'papel',
  descricao: 'descrição',
  dias_alerta: 'janela de alerta',
  email_destino: 'e-mail do resumo',
  resumo_escopo: 'escopo do resumo',
  dias_retroativos: 'dias para trás',
  prazo_padrao_dias: 'prazo padrão',
  considerar_recesso: 'considerar recesso',
  webhook_token: 'token do Buscar agora',
  expira_em: 'validade',
  enviado_em: 'e-mail enviado em',
  nome: 'nome',
  rotulo: 'rótulo',
  plano: 'plano',
  situacao: 'situação',
  pago_ate: 'pago até',
  limites: 'limites',
}

const CAMPOS_DE_PESSOA = new Set(['responsavel_id', 'user_id'])

function objeto(valor: Json | null | undefined): Record<string, Json | undefined> | null {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : null
}

function formatarValor(campo: string, valor: Json | undefined, nomes: ReadonlyMap<string, string>): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  if (typeof valor === 'boolean') return valor ? 'sim' : 'não'
  if (typeof valor === 'string') {
    if (CAMPOS_DE_PESSOA.has(campo)) return nomes.get(valor) ?? 'fora da equipe'
    if (campo === 'status' && valor in ROTULO_STATUS) return ROTULO_STATUS[valor as keyof typeof ROTULO_STATUS]
    if (campo === 'papel' && valor in ROTULO_PAPEL) return ROTULO_PAPEL[valor as keyof typeof ROTULO_PAPEL]
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return formatarData(valor)
    if (/^\d{4}-\d{2}-\d{2}T/.test(valor)) return formatarDataHora(valor)
    return valor.length > 60 ? `${valor.slice(0, 57)}…` : valor
  }
  if (typeof valor === 'number') return String(valor)
  return JSON.stringify(valor)
}

/** "status: Pendente → Cumprido · responsável: ana → bruno" a partir de antes/depois. */
export function descreverMudancas(
  antes: Json | null | undefined,
  depois: Json | null | undefined,
  nomes: ReadonlyMap<string, string>,
): string {
  const a = objeto(antes)
  const d = objeto(depois)
  if (!a || !d) return ''
  return Object.keys(d)
    .sort()
    .map((campo) => {
      const rotulo = NOMES_CAMPOS[campo] ?? campo.replace(/_/g, ' ')
      return `${rotulo}: ${formatarValor(campo, a[campo], nomes)} → ${formatarValor(campo, d[campo], nomes)}`
    })
    .join(' · ')
}

/** O que foi criado ou excluído: a OAB, o processo, o feriado, o convite… */
function identificar(registro: Pick<RegistroAuditoria, 'acao' | 'antes' | 'depois' | 'detalhe'>): string {
  const linha = objeto(registro.depois) ?? objeto(registro.antes)
  const detalhe = resumirDetalhe(registro.detalhe)
  if (!linha) return detalhe
  const tabela = registro.acao.split(':')[1]
  if (tabela === 'monitoramentos') {
    return linha.tipo === 'oab'
      ? `OAB ${String(linha.oab_numero ?? '')}/${String(linha.oab_uf ?? '')}`
      : `processo ${String(linha.numero_processo ?? '')}`
  }
  if (tabela === 'feriados_organizacao') {
    return [formatarData(typeof linha.data === 'string' ? linha.data : null), linha.descricao].filter(Boolean).join(' · ')
  }
  if (tabela === 'convites' || tabela === 'membros') {
    const papel = typeof linha.papel === 'string' ? formatarValor('papel', linha.papel, new Map()) : ''
    const email = objeto(registro.detalhe)?.email
    return [typeof email === 'string' ? email : '', papel].filter(Boolean).join(' · ')
  }
  return detalhe
}

/** Texto da coluna "Alterações" na tela e no CSV. */
export function descreverRegistro(
  registro: Pick<RegistroAuditoria, 'acao' | 'antes' | 'depois' | 'detalhe'>,
  nomes: ReadonlyMap<string, string>,
): string {
  const mudancas = descreverMudancas(registro.antes, registro.depois, nomes)
  if (mudancas) {
    const processo = objeto(registro.detalhe)?.processo
    return typeof processo === 'string' && processo ? `processo ${processo} · ${mudancas}` : mudancas
  }
  return identificar(registro)
}

/** Uma linha do histórico do prazo: "ana cumpriu", "Suporte Despert mudou o vencimento"… */
export function descreverAlteracao(alteracao: AlteracaoPrazo, nomes: ReadonlyMap<string, string>): string {
  if (alteracao.acao === 'insert:prazos') return 'Criou o prazo'
  return descreverMudancas(alteracao.antes, alteracao.depois, nomes)
}

export function autorDaAlteracao(alteracao: Pick<AlteracaoPrazo, 'por_dev' | 'autor_email'>): string {
  if (alteracao.por_dev) return 'Suporte Despert'
  return alteracao.autor_email ?? 'Ex-membro da equipe'
}

// ------------------------------------------------------------------ exportação

export function nomeDoArquivo(base: string, hoje: DataISO): string {
  return `${base}-${hoje}.csv`
}

export function csvDaAuditoria(registros: readonly RegistroAuditoria[], nomes: ReadonlyMap<string, string>): string {
  return gerarCsv(
    ['Data e hora', 'Autor', 'Ação', 'Alterações'],
    registros.map((r) => [
      formatarDataHora(r.criado_em),
      rotuloDoAutor(r),
      descreverAcao(r.acao),
      descreverRegistro(r, nomes),
    ]),
  )
}

const COLUNAS_PRAZOS = [
  'Processo',
  'Tribunal',
  'Órgão',
  'Tipo',
  'Classe',
  'Partes',
  'Disponibilização',
  'Publicação',
  'Início do prazo',
  'Prazo (dias úteis)',
  'Vencimento',
  'Status',
  'Responsável',
  'Também intimados',
  'Cumprido em',
  'Observações',
  'Link',
]

/** `nomes`: id → e-mail de quem está na equipe; quem saiu aparece como "Fora da equipe". */
export function csvDePrazos(prazos: readonly Prazo[], nomes: ReadonlyMap<string, string>): string {
  const nome = (id: string | null) => (id ? (nomes.get(id) ?? 'Fora da equipe') : '')
  return gerarCsv(
    COLUNAS_PRAZOS,
    prazos.map((p) => [
      p.processo,
      p.tribunal,
      p.orgao,
      p.tipo,
      p.classe,
      p.partes,
      p.data_disponibilizacao ? formatarData(p.data_disponibilizacao) : '',
      p.data_publicacao ? formatarData(p.data_publicacao) : '',
      p.inicio_prazo ? formatarData(p.inicio_prazo) : '',
      p.prazo_dias,
      p.vencimento ? formatarData(p.vencimento) : '',
      ROTULO_STATUS[p.status],
      nome(p.responsavel_id),
      p.tambem_intimados.map(nome).join(', '),
      p.cumprido_em ? formatarDataHora(p.cumprido_em) : '',
      p.observacoes,
      p.link,
    ]),
  )
}
