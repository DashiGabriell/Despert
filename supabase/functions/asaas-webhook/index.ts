// Edge Function "asaas-webhook": o Asaas avisa quando um checkout é pago (ADR-0010).
// O JWT do Supabase fica desligado neste deploy — o Asaas não envia esse token.
// A chamada só entra se o header asaas-access-token bater com ASAAS_WEBHOOK_TOKEN.
import { createClient } from 'npm:@supabase/supabase-js@2'

function responder(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

function tokensIguais(esperado: string, recebido: string): boolean {
  const a = new TextEncoder().encode(esperado)
  const b = new TextEncoder().encode(recebido)
  if (a.length === 0 || a.length !== b.length) return false
  return crypto.subtle.timingSafeEqual(a, b)
}

Deno.serve(async (req) => {
  if (req.method === 'GET') return responder({ ok: true })
  if (req.method !== 'POST') return responder({ erro: 'Método não permitido.' }, 405)

  if (!tokensIguais(Deno.env.get('ASAAS_WEBHOOK_TOKEN') ?? '', req.headers.get('asaas-access-token') ?? '')) {
    return responder({ erro: 'Token inválido.' }, 401)
  }

  let corpo: Record<string, unknown>
  try {
    corpo = await req.json()
  } catch {
    return responder({ erro: 'Corpo da requisição inválido.' }, 400)
  }

  const evento = texto(corpo.event)
  if (!evento) return responder({ erro: 'Evento ausente.' }, 400)

  if (evento === 'CHECKOUT_PAID') {
    const checkout = corpo.checkout
    const asaasId =
      checkout && typeof checkout === 'object' ? texto((checkout as { id?: unknown }).id) : ''
    const eventoId = texto(corpo.id)
    if (!asaasId || !eventoId) return responder({ ok: true, ignorado: 'sem_id' })

    const servico = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await servico.rpc('registrar_checkout_pago', {
      p_asaas_id: asaasId,
      p_evento_id: eventoId,
    })
    if (error) return responder({ erro: 'Não foi possível registrar o pagamento.' }, 500)
    return responder({ ok: true, resultado: data })
  }

  return responder({ ok: true })
})
