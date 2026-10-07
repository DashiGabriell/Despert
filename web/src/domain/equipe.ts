import type { Convite, EscopoResumo, MembroDaEquipe, PapelMembro } from '../lib/database.types'

export const ROTULO_PAPEL: Record<PapelMembro, string> = {
  administrador: 'Administrador',
  advogado: 'Advogado',
  assistente: 'Assistente',
  leitura: 'Leitura',
}

export const DESCRICAO_PAPEL: Record<PapelMembro, string> = {
  administrador: 'Tudo, inclusive equipe, feriados e configurações da organização.',
  advogado: 'Prazos, a própria OAB e processos monitorados.',
  assistente: 'Cria, edita e cumpre prazos; não exclui nem mexe em monitoramentos.',
  leitura: 'Só consulta prazos e agenda.',
}

/** Resumo diário: o que a pessoa escolheu ou, sem escolha, o padrão do papel (#18). */
export function escopoDoResumo(papel: PapelMembro, salvo: EscopoResumo | null | undefined): EscopoResumo {
  if (salvo) return salvo
  return papel === 'advogado' ? 'meus' : 'todos'
}

export type SituacaoConvite = 'pendente' | 'expirado' | 'aceito'

export function situacaoDoConvite(convite: Pick<Convite, 'aceito_em' | 'expira_em'>, agora: number): SituacaoConvite {
  if (convite.aceito_em) return 'aceito'
  return Date.parse(convite.expira_em) <= agora ? 'expirado' : 'pendente'
}

/** Convites ainda não aceitos (pendentes e expirados), do mais novo para o mais antigo. */
export function convitesEmAberto<T extends Pick<Convite, 'aceito_em' | 'criado_em'>>(convites: readonly T[]): T[] {
  return convites.filter((c) => !c.aceito_em).sort((a, b) => b.criado_em.localeCompare(a.criado_em))
}

/** Vagas do plano ainda livres: membros e convites pendentes ocupam uma vaga cada (como no banco). */
export function vagasLivres(
  limiteUsuarios: number,
  membros: number,
  convites: readonly Pick<Convite, 'aceito_em' | 'expira_em'>[],
  agora: number,
): number {
  const pendentes = convites.filter((c) => situacaoDoConvite(c, agora) === 'pendente').length
  return Math.max(0, limiteUsuarios - membros - pendentes)
}

export function linkDoConvite(origem: string, token: string): string {
  return `${origem.replace(/\/+$/, '')}/convite/${token}`
}

export function mailtoDoConvite(dados: {
  email: string
  organizacao: string
  papel: PapelMembro
  link: string
}): string {
  const assunto = `Convite para a equipe ${dados.organizacao} no Despert`
  const corpo = [
    'Olá!',
    '',
    `Você foi convidado(a) para a equipe ${dados.organizacao} no Despert, como ${ROTULO_PAPEL[dados.papel]}.`,
    'Para aceitar, abra o link abaixo e entre (ou crie sua conta) com este e-mail:',
    '',
    dados.link,
    '',
    'O convite vale por 7 dias.',
  ].join('\n')
  return `mailto:${encodeURIComponent(dados.email)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`
}

/** Quem pode ter OAB monitorada: Administradores e Advogados. */
export function donosDeOab<T extends Pick<MembroDaEquipe, 'papel'>>(membros: readonly T[]): T[] {
  return membros.filter((m) => m.papel === 'administrador' || m.papel === 'advogado')
}

/** Nome curto para listas: a parte do e-mail antes do @; "você" para a própria pessoa. */
export function nomeDoMembro(membro: Pick<MembroDaEquipe, 'user_id' | 'email'> | undefined, eu?: string): string {
  if (!membro) return 'Fora da equipe'
  const nome = membro.email.split('@')[0] || membro.email
  return membro.user_id === eu ? `${nome} (você)` : nome
}
