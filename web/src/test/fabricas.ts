import type { Prazo, RegistroAuditoria } from '../lib/database.types'

let sequencia = 0

export function fabricarRegistro(parcial: Partial<RegistroAuditoria> = {}): RegistroAuditoria {
  sequencia++
  return {
    id: sequencia,
    criado_em: '2026-10-06T13:30:00Z',
    organizacao_id: 'org-1',
    dev_id: null,
    dev_email: null,
    membro_id: 'bruno-1',
    membro_email: 'bruno@exemplo.com',
    acao: 'update:prazos',
    alvo_user_id: null,
    alvo_email: null,
    detalhe: {},
    antes: null,
    depois: null,
    ...parcial,
  }
}

export function fabricarPrazo(parcial: Partial<Prazo> = {}): Prazo {
  sequencia++
  return {
    id: `prazo-${sequencia}`,
    organizacao_id: 'org-1',
    user_id: 'advogada-1',
    responsavel_id: 'advogada-1',
    tambem_intimados: [],
    djen_id: `djen-${sequencia}`,
    processo: '0801234-56.2026.8.26.0100',
    tribunal: 'TJSP',
    orgao: '1ª Vara Cível',
    tipo: 'Intimação',
    classe: 'Procedimento Comum',
    partes: 'ACME LTDA (Polo ativo)',
    prazo_dias: 15,
    origem_prazo: 'Identificado no texto',
    data_disponibilizacao: '2026-10-01',
    data_publicacao: '2026-10-02',
    inicio_prazo: '2026-10-05',
    vencimento: '2026-10-23',
    status: 'pendente',
    link: 'https://comunica.pje.jus.br/',
    teor: 'Fica a parte intimada para, no prazo de 15 dias, apresentar contestação.',
    observacoes: null,
    cumprido_em: null,
    created_at: '2026-10-02T10:00:00Z',
    updated_at: '2026-10-02T10:00:00Z',
    ...parcial,
  }
}
