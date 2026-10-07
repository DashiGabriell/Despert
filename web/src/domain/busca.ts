/** Intervalo mínimo entre dois disparos do "Buscar agora" pelo mesmo advogado. */
export const COOLDOWN_MS = 10 * 60 * 1000

/** Quanto tempo depois do disparo a aplicação desiste de esperar a execução aparecer. */
export const LIMITE_ESPERA_MS = 3 * 60 * 1000

/** Tolerância para relógios diferentes entre o navegador e o servidor do robô. */
const TOLERANCIA_RELOGIO_MS = 30 * 1000

export type PendenciaBusca = 'webhook' | 'monitoramento' | null

/**
 * O que falta antes de o botão poder disparar o robô. A URL do webhook é da configuração do
 * sistema (só o dev define); o monitoramento ativo é do advogado.
 */
export function pendenciaBusca(
  webhookUrl: string | null | undefined,
  monitoramentos: readonly { ativo: boolean }[],
): PendenciaBusca {
  if (!webhookUrl?.trim()) return 'webhook'
  if (!monitoramentos.some((m) => m.ativo)) return 'monitoramento'
  return null
}

export function urlDisparo(webhook: string, token: string): string {
  const base = webhook.trim()
  return `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
}

/** Milissegundos que ainda faltam para liberar um novo disparo (0 quando liberado). */
export function restanteCooldown(ultimaBusca: string | null | undefined, agora: number): number {
  if (!ultimaBusca) return 0
  const decorrido = agora - Date.parse(ultimaBusca)
  if (Number.isNaN(decorrido)) return 0
  return Math.min(COOLDOWN_MS, Math.max(0, COOLDOWN_MS - decorrido))
}

/** `m:ss` para a contagem regressiva do botão. */
export function formatarRestante(ms: number): string {
  const totalSegundos = Math.ceil(ms / 1000)
  const minutos = Math.floor(totalSegundos / 60)
  const segundos = totalSegundos % 60
  return `${minutos}:${String(segundos).padStart(2, '0')}`
}

/** A primeira execução registrada depois do disparo, se o robô já respondeu. */
export function execucaoDoDisparo<T extends { executado_em: string }>(
  execucoes: readonly T[],
  disparadoEm: number,
): T | null {
  return (
    execucoes.find((e) => Date.parse(e.executado_em) >= disparadoEm - TOLERANCIA_RELOGIO_MS) ?? null
  )
}

export type EstadoBusca = 'ocioso' | 'buscando' | 'bloqueado'

export function estadoDaBusca(opcoes: {
  disparadoEm: number | null
  respondida: boolean
  restanteMs: number
  agora: number
}): EstadoBusca {
  const { disparadoEm, respondida, restanteMs, agora } = opcoes
  if (disparadoEm !== null && !respondida && agora - disparadoEm < LIMITE_ESPERA_MS) {
    return 'buscando'
  }
  return restanteMs > 0 ? 'bloqueado' : 'ocioso'
}
