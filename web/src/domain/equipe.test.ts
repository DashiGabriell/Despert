import { describe, expect, it } from 'vitest'
import {
  convitesEmAberto,
  donosDeOab,
  escopoDoResumo,
  linkDoConvite,
  mailtoDoConvite,
  nomeDoMembro,
  situacaoDoConvite,
  vagasLivres,
} from './equipe'

const AGORA = Date.parse('2026-10-07T12:00:00Z')

describe('escopo do resumo diário', () => {
  it('sem escolha: Advogado recebe os próprios; os demais papéis, todos', () => {
    expect(escopoDoResumo('advogado', null)).toBe('meus')
    expect(escopoDoResumo('administrador', null)).toBe('todos')
    expect(escopoDoResumo('assistente', undefined)).toBe('todos')
    expect(escopoDoResumo('leitura', null)).toBe('todos')
  })

  it('a escolha da pessoa vale sobre o padrão', () => {
    expect(escopoDoResumo('advogado', 'todos')).toBe('todos')
    expect(escopoDoResumo('administrador', 'meus')).toBe('meus')
  })
})

describe('convites', () => {
  it('situação: aceito, expirado ou pendente', () => {
    expect(situacaoDoConvite({ aceito_em: '2026-10-01T00:00:00Z', expira_em: '2026-10-02T00:00:00Z' }, AGORA)).toBe('aceito')
    expect(situacaoDoConvite({ aceito_em: null, expira_em: '2026-10-07T12:00:00Z' }, AGORA)).toBe('expirado')
    expect(situacaoDoConvite({ aceito_em: null, expira_em: '2026-10-10T00:00:00Z' }, AGORA)).toBe('pendente')
  })

  it('em aberto: sem os aceitos, do mais novo para o mais antigo', () => {
    const lista = convitesEmAberto([
      { aceito_em: null, criado_em: '2026-10-01T00:00:00Z' },
      { aceito_em: '2026-10-03T00:00:00Z', criado_em: '2026-10-02T00:00:00Z' },
      { aceito_em: null, criado_em: '2026-10-05T00:00:00Z' },
    ])
    expect(lista.map((c) => c.criado_em)).toEqual(['2026-10-05T00:00:00Z', '2026-10-01T00:00:00Z'])
  })

  it('vagas livres descontam membros e convites pendentes, não os expirados', () => {
    const convites = [
      { aceito_em: null, expira_em: '2026-10-10T00:00:00Z' },
      { aceito_em: null, expira_em: '2026-10-01T00:00:00Z' },
    ]
    expect(vagasLivres(10, 3, convites, AGORA)).toBe(6)
    expect(vagasLivres(4, 3, convites, AGORA)).toBe(0)
    expect(vagasLivres(2, 3, [], AGORA)).toBe(0)
  })

  it('link e e-mail do convite', () => {
    const link = linkDoConvite('https://despert.app/', 'abc123')
    expect(link).toBe('https://despert.app/convite/abc123')
    const mailto = mailtoDoConvite({ email: 'bia@ex.com', organizacao: 'Silva & Sá', papel: 'assistente', link })
    expect(mailto.startsWith('mailto:bia%40ex.com?subject=')).toBe(true)
    const corpo = decodeURIComponent(mailto.split('&body=')[1])
    expect(corpo).toContain('como Assistente')
    expect(corpo).toContain(link)
    expect(decodeURIComponent(mailto.split('subject=')[1].split('&body=')[0])).toBe(
      'Convite para a equipe Silva & Sá no Despert',
    )
  })
})

describe('membros', () => {
  it('só Administradores e Advogados podem ter OAB', () => {
    const membros = [
      { papel: 'administrador' as const },
      { papel: 'advogado' as const },
      { papel: 'assistente' as const },
      { papel: 'leitura' as const },
    ]
    expect(donosDeOab(membros).map((m) => m.papel)).toEqual(['administrador', 'advogado'])
  })

  it('nome curto, marcando a própria pessoa', () => {
    expect(nomeDoMembro({ user_id: 'u1', email: 'ana@ex.com' })).toBe('ana')
    expect(nomeDoMembro({ user_id: 'u1', email: 'ana@ex.com' }, 'u1')).toBe('ana (você)')
    expect(nomeDoMembro(undefined)).toBe('Fora da equipe')
  })
})
