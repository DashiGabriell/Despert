import { describe, expect, it } from 'vitest'
import {
  validarConfiguracaoOrganizacao,
  validarConfiguracaoPessoal,
  validarConvite,
  validarFeriado,
  validarMonitoramento,
  validarNovaConta,
  validarNovaSenha,
  validarPrazoManual,
  validarUrlWebhook,
  type FormConfiguracaoOrganizacao,
  type FormConfiguracaoPessoal,
  type FormNovaConta,
  type FormPrazoManual,
} from './validacao'

describe('validarMonitoramento', () => {
  const base = { tipo: 'oab' as const, oab: '', uf: 'SP', processo: '', descricao: '' }

  it('aceita OAB com UF, limpando a pontuação do número', () => {
    expect(validarMonitoramento({ ...base, oab: '123.456', descricao: ' Minha OAB ' })).toEqual({
      ok: true,
      valor: {
        tipo: 'oab',
        oab_numero: '123456',
        oab_uf: 'SP',
        numero_processo: null,
        descricao: 'Minha OAB',
      },
    })
  })

  it('recusa OAB sem número, UF inválida ou duplicada', () => {
    expect(validarMonitoramento({ ...base, oab: '' }).ok).toBe(false)
    expect(validarMonitoramento({ ...base, oab: '1', uf: 'XX' }).ok).toBe(false)
    const existente = {
      tipo: 'oab' as const,
      oab_numero: '123456',
      oab_uf: 'SP',
      numero_processo: null,
      descricao: null,
    }
    expect(validarMonitoramento({ ...base, oab: '123456' }, [existente])).toEqual({
      ok: false,
      erro: 'A OAB 123456/SP já está cadastrada.',
    })
  })

  it('valida o processo nos 20 dígitos do CNJ e grava com máscara', () => {
    const processo = { ...base, tipo: 'processo' as const }
    expect(validarMonitoramento({ ...processo, processo: '123' })).toEqual({
      ok: false,
      erro: 'O número do processo deve ter 20 dígitos (padrão CNJ).',
    })
    const ok = validarMonitoramento({ ...processo, processo: '08012345620268260100' })
    expect(ok.ok && ok.valor.numero_processo).toBe('0801234-56.2026.8.26.0100')
  })
})

describe('validarFeriado', () => {
  it('exige data válida, descrição e recusa duplicidade', () => {
    expect(validarFeriado({ data: '2026-02-30', descricao: 'x' }, []).ok).toBe(false)
    expect(validarFeriado({ data: '2026-02-17', descricao: '  ' }, []).ok).toBe(false)
    expect(validarFeriado({ data: '2026-02-17', descricao: 'Carnaval' }, ['2026-02-17'])).toEqual({
      ok: false,
      erro: 'Já existe um feriado cadastrado nessa data.',
    })
    expect(validarFeriado({ data: '2026-02-17', descricao: ' Carnaval ' }, [])).toEqual({
      ok: true,
      valor: { data: '2026-02-17', descricao: 'Carnaval' },
    })
  })
})

describe('validarPrazoManual', () => {
  const form: FormPrazoManual = {
    processo: '0801234-56.2026.8.26.0100',
    tribunal: 'tjsp',
    tipo: '',
    inicio: '',
    dias: '',
    vencimento: '2026-10-20',
    observacoes: '',
  }

  it('grava com origem "Cadastro manual", tribunal em maiúsculas e tipo padrão', () => {
    expect(validarPrazoManual(form)).toEqual({
      ok: true,
      valor: {
        processo: '0801234-56.2026.8.26.0100',
        tribunal: 'TJSP',
        tipo: 'Prazo manual',
        inicio_prazo: null,
        prazo_dias: null,
        vencimento: '2026-10-20',
        observacoes: null,
        origem_prazo: 'Cadastro manual',
        status: 'pendente',
      },
    })
  })

  it('recusa processo fora do padrão, dias inválidos e vencimento ausente ou antes do início', () => {
    expect(validarPrazoManual({ ...form, processo: '123' }).ok).toBe(false)
    expect(validarPrazoManual({ ...form, dias: '0' }).ok).toBe(false)
    expect(validarPrazoManual({ ...form, dias: '2,5' }).ok).toBe(false)
    expect(validarPrazoManual({ ...form, vencimento: '' }).ok).toBe(false)
    expect(validarPrazoManual({ ...form, inicio: '2026-10-21' })).toEqual({
      ok: false,
      erro: 'O vencimento não pode ser anterior ao início do prazo.',
    })
  })
})

describe('validarConfiguracaoPessoal', () => {
  const form: FormConfiguracaoPessoal = { email_destino: ' ana@exemplo.com ', dias_alerta: '7', resumo_escopo: 'meus' }

  it('converte a janela e mantém o escopo', () => {
    expect(validarConfiguracaoPessoal(form)).toEqual({
      ok: true,
      valor: { email_destino: 'ana@exemplo.com', dias_alerta: 7, resumo_escopo: 'meus' },
    })
  })

  it('aponta e-mail inválido e janela fora da faixa', () => {
    expect(validarConfiguracaoPessoal({ ...form, email_destino: 'ana' })).toEqual({
      ok: false,
      erro: 'Informe um e-mail válido para os alertas.',
    })
    expect(validarConfiguracaoPessoal({ ...form, dias_alerta: 'x' }).ok).toBe(false)
    expect(validarConfiguracaoPessoal({ ...form, dias_alerta: '61' }).ok).toBe(false)
  })
})

describe('validarConfiguracaoOrganizacao', () => {
  const form: FormConfiguracaoOrganizacao = {
    dias_retroativos: '5',
    prazo_padrao_dias: '15',
    considerar_recesso: true,
    webhook_token: 'a1b2c3d4e5f6a7b8c9d0',
  }

  it('converte os números', () => {
    const resultado = validarConfiguracaoOrganizacao(form)
    expect(resultado.ok && resultado.valor.prazo_padrao_dias).toBe(15)
  })

  it('aponta o campo fora da faixa ou inválido', () => {
    expect(validarConfiguracaoOrganizacao({ ...form, dias_retroativos: '31' }).ok).toBe(false)
    expect(validarConfiguracaoOrganizacao({ ...form, prazo_padrao_dias: '0' }).ok).toBe(false)
    expect(validarConfiguracaoOrganizacao({ ...form, webhook_token: 'curto' })).toEqual({
      ok: false,
      erro: 'Gere um novo token de segurança.',
    })
  })
})

describe('validarConvite', () => {
  it('normaliza o e-mail', () => {
    expect(validarConvite({ email: ' Bia@Ex.com ', papel: 'assistente' }, [], [])).toEqual({
      ok: true,
      valor: { email: 'bia@ex.com', papel: 'assistente' },
    })
  })

  it('recusa e-mail inválido, quem já é da equipe e convite repetido', () => {
    expect(validarConvite({ email: 'bia', papel: 'leitura' }, [], []).ok).toBe(false)
    expect(validarConvite({ email: 'ANA@ex.com', papel: 'leitura' }, ['ana@ex.com'], [])).toEqual({
      ok: false,
      erro: 'Essa pessoa já faz parte da equipe.',
    })
    expect(validarConvite({ email: 'bia@ex.com', papel: 'leitura' }, [], ['bia@ex.com']).ok).toBe(false)
  })
})

describe('validarUrlWebhook', () => {
  it('aceita vazio (desliga o botão) e exige http(s)', () => {
    expect(validarUrlWebhook('  ')).toEqual({ ok: true, valor: '' })
    expect(validarUrlWebhook(' https://n8n.vps/webhook/monitor-prazos ')).toEqual({
      ok: true,
      valor: 'https://n8n.vps/webhook/monitor-prazos',
    })
    expect(validarUrlWebhook('n8n.vps/webhook').ok).toBe(false)
  })
})

describe('validarNovaConta', () => {
  const form: FormNovaConta = { email: ' Nova@Exemplo.com ', senha: 'senhaforte1', papel: 'advogado' }

  it('normaliza o e-mail e mantém senha e papel', () => {
    expect(validarNovaConta(form, [])).toEqual({
      ok: true,
      valor: { email: 'nova@exemplo.com', senha: 'senhaforte1', papel: 'advogado' },
    })
  })

  it('recusa e-mail inválido, repetido e senha curta', () => {
    expect(validarNovaConta({ ...form, email: 'nova' }, []).ok).toBe(false)
    expect(validarNovaConta(form, ['NOVA@exemplo.com'])).toEqual({
      ok: false,
      erro: 'Já existe uma conta com esse e-mail.',
    })
    expect(validarNovaConta({ ...form, senha: '1234567' }, [])).toEqual({
      ok: false,
      erro: 'A senha precisa ter pelo menos 8 caracteres.',
    })
    expect(validarNovaSenha('12345678').ok).toBe(true)
  })
})
