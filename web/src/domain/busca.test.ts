import { describe, expect, it } from 'vitest'
import {
  COOLDOWN_MS,
  estadoDaBusca,
  execucaoDoDisparo,
  formatarRestante,
  pendenciaBusca,
  restanteCooldown,
  urlDisparo,
} from './busca'

describe('pendenciaBusca', () => {
  it('exige webhook antes de monitoramento ativo', () => {
    expect(pendenciaBusca({ n8n_webhook_url: '' }, [{ ativo: true }])).toBe('webhook')
    expect(pendenciaBusca(null, [])).toBe('webhook')
    expect(pendenciaBusca({ n8n_webhook_url: 'https://n8n/x' }, [{ ativo: false }])).toBe(
      'monitoramento',
    )
    expect(pendenciaBusca({ n8n_webhook_url: 'https://n8n/x' }, [{ ativo: true }])).toBeNull()
  })
})

describe('urlDisparo', () => {
  it('acrescenta o token na query string respeitando parâmetros existentes', () => {
    expect(urlDisparo('https://n8n.vps/webhook/monitor-prazos', 'abc')).toBe(
      'https://n8n.vps/webhook/monitor-prazos?token=abc',
    )
    expect(urlDisparo('https://n8n.vps/webhook/x?a=1 ', 'a b')).toBe(
      'https://n8n.vps/webhook/x?a=1&token=a%20b',
    )
  })
})

describe('cooldown de 10 minutos', () => {
  const disparo = '2026-10-06T10:00:00.000Z'
  const base = Date.parse(disparo)

  it('bloqueia por 10 minutos depois do último disparo', () => {
    expect(restanteCooldown(disparo, base)).toBe(COOLDOWN_MS)
    expect(restanteCooldown(disparo, base + 9 * 60_000)).toBe(60_000)
    expect(restanteCooldown(disparo, base + 10 * 60_000)).toBe(0)
    expect(restanteCooldown(null, base)).toBe(0)
  })

  it('formata a contagem regressiva em m:ss', () => {
    expect(formatarRestante(COOLDOWN_MS)).toBe('10:00')
    expect(formatarRestante(61_000)).toBe('1:01')
    expect(formatarRestante(500)).toBe('0:01')
  })
})

describe('execucaoDoDisparo', () => {
  it('só reconhece execuções registradas depois do disparo', () => {
    const disparo = Date.parse('2026-10-06T10:00:00Z')
    const antiga = { executado_em: '2026-10-06T07:00:00Z' }
    const nova = { executado_em: '2026-10-06T10:00:40Z' }
    expect(execucaoDoDisparo([antiga], disparo)).toBeNull()
    expect(execucaoDoDisparo([nova, antiga], disparo)).toBe(nova)
  })
})

describe('estadoDaBusca', () => {
  const agora = Date.parse('2026-10-06T10:01:00Z')

  it('fica "buscando" até o robô responder ou estourar o tempo de espera', () => {
    const disparadoEm = agora - 60_000
    expect(estadoDaBusca({ disparadoEm, respondida: false, restanteMs: 1, agora })).toBe('buscando')
    expect(estadoDaBusca({ disparadoEm, respondida: true, restanteMs: 1, agora })).toBe('bloqueado')
    expect(
      estadoDaBusca({ disparadoEm: agora - 4 * 60_000, respondida: false, restanteMs: 1, agora }),
    ).toBe('bloqueado')
  })

  it('volta a "ocioso" quando o cooldown acaba', () => {
    expect(estadoDaBusca({ disparadoEm: null, respondida: false, restanteMs: 0, agora })).toBe(
      'ocioso',
    )
  })
})
