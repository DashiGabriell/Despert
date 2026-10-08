// Edge Function "asaas-checkout": abre o Checkout hospedado do Asaas (ADR-0010).
// O JWT fica ligado. O preço sai do servidor. O cartão não passa por aqui.
import { createClient } from 'npm:@supabase/supabase-js@2'

const PRECO: Record<string, number> = { solo: 79.9, escritorio: 397.9, corporativo: 849.9 }
const ROTULO: Record<string, string> = { solo: 'Solo', escritorio: 'Escritório', corporativo: 'Corporativo' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function cors(origem: string | null): Record<string, string> {
  if (!origem) return {}
  return {
    'Access-Control-Allow-Origin': origem,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function responder(corpo: unknown, status = 200, origem: string | null = null): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors(origem), 'Content-Type': 'application/json' },
  })
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

function origemPermitida(bruta: string | null): string | null {
  if (!bruta) return null
  let url: URL
  try {
    url = new URL(bruta)
  } catch {
    return null
  }
  const local = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  if (local) return url.origin
  if (url.protocol !== 'https:') return null
  const permitidas = (Deno.env.get('CHECKOUT_ORIGENS') ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean)
  return permitidas.includes(url.origin) ? url.origin : null
}

function sandbox(chave: string): boolean {
  return chave.includes('_hmlg_')
}

function linkConfiavel(link: string, emSandbox: boolean): boolean {
  try {
    const url = new URL(link)
    const hosts = emSandbox ? ['sandbox.asaas.com'] : ['asaas.com', 'www.asaas.com']
    return url.protocol === 'https:' && hosts.includes(url.hostname)
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  const origem = origemPermitida(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response(null, { status: origem ? 204 : 403, headers: cors(origem) })
  if (!origem) return responder({ erro: 'Abra o pagamento pelo site do Despert.' }, 403)
  const r = (corpo: unknown, status = 200) => responder(corpo, status, origem)
  if (req.method !== 'POST') return r({ erro: 'Método não permitido.' }, 405)

  const chave = Deno.env.get('ASAAS_API_KEY') ?? ''
  if (!chave) return r({ erro: 'Pagamento indisponível.' }, 503)

  const servico = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const sessao = jwt ? await servico.auth.getUser(jwt) : null
  const usuario = sessao?.data.user
  if (!usuario) return r({ erro: 'Sessão inválida. Entre de novo.' }, 401)

  let corpo: Record<string, unknown>
  try {
    corpo = await req.json()
  } catch {
    return r({ erro: 'Corpo da requisição inválido.' }, 400)
  }

  const plano = texto(corpo.plano)
  const organizacaoId = texto(corpo.organizacaoId)
  const valor = PRECO[plano]
  if (!valor || !UUID.test(organizacaoId)) return r({ erro: 'Plano inválido.' }, 400)

  const { data: membro } = await servico
    .from('membros')
    .select('papel')
    .eq('organizacao_id', organizacaoId)
    .eq('user_id', usuario.id)
    .maybeSingle()
  if (membro?.papel !== 'administrador') return r({ erro: 'Só o Administrador contrata o plano.' }, 403)

  const emSandbox = sandbox(chave)
  const base = emSandbox ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3'
  const retorno = (resultado: string) => `${origem}/checkout/retorno?resultado=${resultado}`
  const pedido = {
    billingTypes: ['PIX', 'CREDIT_CARD'],
    chargeTypes: ['DETACHED'],
    minutesToExpire: 60,
    externalReference: `${organizacaoId}:${plano}`,
    callback: {
      successUrl: retorno('pago'),
      cancelUrl: retorno('cancelado'),
      expiredUrl: retorno('expirado'),
    },
    items: [
      {
        name: `Despert ${ROTULO[plano]}`,
        description: 'Mensalidade de 1 mês',
        quantity: 1,
        value: valor,
      },
    ],
  }

  const resposta = await fetch(`${base}/checkouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/json',
      access_token: chave,
      'User-Agent': 'Despert',
    },
    body: JSON.stringify(pedido),
  })
  const json: unknown = await resposta.json().catch(() => null)
  const dados = json && typeof json === 'object' ? (json as { id?: unknown; link?: unknown; errors?: { description?: string }[] }) : null
  if (!resposta.ok || !dados) {
    const detalhe = dados?.errors?.[0]?.description
    return r({ erro: detalhe || 'O Asaas não abriu o pagamento.' }, 502)
  }

  const id = texto(dados.id)
  const link = texto(dados.link)
  if (!id || !linkConfiavel(link, emSandbox)) return r({ erro: 'O Asaas não devolveu o link de pagamento.' }, 502)

  const { error } = await servico.from('checkouts').insert({
    organizacao_id: organizacaoId,
    plano,
    valor,
    asaas_id: id,
  })
  if (error) return r({ erro: 'Não foi possível registrar o pagamento.' }, 500)

  return r({ url: link })
})
