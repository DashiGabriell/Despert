import { describe, expect, it } from 'vitest'
import {
  descreverAcao,
  ehModoDev,
  filtrarContas,
  interpretarTesteWebhook,
  lerAtuacao,
  MODOS_DEV,
  papelDe,
  resumirDetalhe,
  rotaDev,
  rotaInicial,
} from './acesso'

describe('papelDe', () => {
  it('reconhece o dev só pelo app_metadata.app_role', () => {
    expect(papelDe({ app_metadata: { app_role: 'dev' } })).toBe('dev')
    expect(papelDe({ app_metadata: { app_role: 'admin' } })).toBe('advogado')
    expect(papelDe({ app_metadata: {} })).toBe('advogado')
    expect(papelDe(null)).toBe('advogado')
  })
})

describe('rotas do painel dev', () => {
  it('monta /dashitecnology/{modo} e valida o modo', () => {
    expect(rotaDev()).toBe('/dashitecnology/visao-geral')
    expect(rotaDev('n8n')).toBe('/dashitecnology/n8n')
    for (const { modo } of MODOS_DEV) expect(ehModoDev(modo)).toBe(true)
    expect(ehModoDev('prazos')).toBe(false)
    expect(ehModoDev(undefined)).toBe(false)
  })

  it('manda o dev ao painel e o advogado (ou o dev atuando) aos prazos', () => {
    expect(rotaInicial('dev', false)).toBe('/dashitecnology/visao-geral')
    expect(rotaInicial('dev', true)).toBe('/prazos')
    expect(rotaInicial('advogado', false)).toBe('/prazos')
  })
})

describe('lerAtuacao', () => {
  it('aceita só o formato salvo pela aplicação', () => {
    expect(lerAtuacao('{"userId":"u1","email":"ana@x.com"}')).toEqual({ userId: 'u1', email: 'ana@x.com' })
    expect(lerAtuacao(null)).toBeNull()
    expect(lerAtuacao('não é json')).toBeNull()
    expect(lerAtuacao('{"userId":"","email":"x"}')).toBeNull()
    expect(lerAtuacao('{"userId":1,"email":"x"}')).toBeNull()
  })
})

describe('descreverAcao', () => {
  it('traduz ações administrativas e escritas por tabela', () => {
    expect(descreverAcao('bloquear')).toBe('Bloqueou conta')
    expect(descreverAcao('atuar_como')).toBe('Entrou como advogado')
    expect(descreverAcao('update:prazos')).toBe('Alterou prazo')
    expect(descreverAcao('delete:monitoramentos')).toBe('Excluiu monitoramento')
    expect(descreverAcao('update:configuracao_sistema')).toBe('Alterou configuração do sistema')
    expect(descreverAcao('insert:tabela_nova')).toBe('Criou tabela_nova')
    expect(descreverAcao('outra')).toBe('outra')
  })
})

describe('resumirDetalhe', () => {
  it('monta uma linha com processo, papel e campos alterados', () => {
    expect(resumirDetalhe({ registro: 'x', processo: '0001', campos: ['status', 'cumprido_em'] })).toBe(
      'processo 0001 · campos: status, data de cumprimento',
    )
    expect(resumirDetalhe({ papel: 'dev' })).toBe('papel dev')
    expect(resumirDetalhe({ campos: ['n8n_webhook_url'] })).toBe('campos: URL do webhook')
    expect(resumirDetalhe({})).toBe('')
    expect(resumirDetalhe(null)).toBe('')
    expect(resumirDetalhe([1])).toBe('')
  })
})

describe('interpretarTesteWebhook', () => {
  it('diferencia sucesso, URL errada, erro e resposta ilegível', () => {
    expect(interpretarTesteWebhook(200).tipo).toBe('ok')
    expect(interpretarTesteWebhook(404)).toMatchObject({ tipo: 'erro', mensagem: expect.stringMatching(/Production URL/) })
    expect(interpretarTesteWebhook(500).tipo).toBe('erro')
    expect(interpretarTesteWebhook(null).tipo).toBe('aviso')
  })
})

describe('filtrarContas', () => {
  it('filtra por trecho do e-mail sem diferenciar maiúsculas', () => {
    const contas = [{ email: 'ana@exemplo.com' }, { email: 'bia@outro.com' }]
    expect(filtrarContas(contas, 'ANA')).toEqual([{ email: 'ana@exemplo.com' }])
    expect(filtrarContas(contas, '  ')).toHaveLength(2)
  })
})
