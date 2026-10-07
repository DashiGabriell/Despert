import { describe, expect, it } from 'vitest'
import {
  validarConfiguracao,
  validarFeriado,
  validarMonitoramento,
  validarPrazoManual,
  type FormConfiguracao,
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

describe('validarConfiguracao', () => {
  const form: FormConfiguracao = {
    email_destino: 'ana@exemplo.com',
    dias_retroativos: '5',
    prazo_padrao_dias: '15',
    dias_alerta: '7',
    considerar_recesso: true,
    n8n_webhook_url: '',
    webhook_token: 'a1b2c3d4e5f6a7b8c9d0',
  }

  it('converte os números e aceita webhook vazio', () => {
    const resultado = validarConfiguracao(form)
    expect(resultado.ok && resultado.valor.dias_alerta).toBe(7)
  })

  it('aponta o campo fora da faixa ou inválido', () => {
    expect(validarConfiguracao({ ...form, email_destino: 'ana' })).toEqual({
      ok: false,
      erro: 'Informe um e-mail válido para os alertas.',
    })
    expect(validarConfiguracao({ ...form, dias_retroativos: '31' }).ok).toBe(false)
    expect(validarConfiguracao({ ...form, prazo_padrao_dias: '0' }).ok).toBe(false)
    expect(validarConfiguracao({ ...form, dias_alerta: 'x' }).ok).toBe(false)
    expect(validarConfiguracao({ ...form, n8n_webhook_url: 'n8n.vps/webhook' }).ok).toBe(false)
  })
})
