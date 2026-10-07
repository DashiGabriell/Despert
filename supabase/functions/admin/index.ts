// Edge Function "admin": ações do painel dev que exigem a chave service_role.
// Só atende quem tem app_metadata.app_role = 'dev' no banco (conferido a cada chamada)
// e grava cada ação na tabela public.auditoria.
import { createClient, type User } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BANIMENTO_PERMANENTE = '876000h'
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

class ErroDeUso extends Error {
  constructor(
    mensagem: string,
    readonly status = 400,
  ) {
    super(mensagem)
  }
}

function responder(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

function validarSenha(senha: string): void {
  if (senha.length < 8) throw new ErroDeUso('A senha precisa ter pelo menos 8 caracteres.')
}

function validarPapel(papel: string): 'dev' | 'advogado' {
  if (papel !== 'dev' && papel !== 'advogado') throw new ErroDeUso('Papel inválido.')
  return papel
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder({ erro: 'Método não permitido.' }, 405)

  const servico = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const sessao = jwt ? await servico.auth.getUser(jwt) : null
  const chamador = sessao?.data.user
  if (!chamador) return responder({ erro: 'Sessão inválida. Entre de novo.' }, 401)

  const atual = await servico.auth.admin.getUserById(chamador.id)
  if (atual.data.user?.app_metadata?.app_role !== 'dev') {
    return responder({ erro: 'Acesso restrito ao dev.' }, 403)
  }

  let corpo: Record<string, unknown>
  try {
    corpo = await req.json()
  } catch {
    return responder({ erro: 'Corpo da requisição inválido.' }, 400)
  }
  const acao = texto(corpo.acao)

  async function auditar(alvo: Pick<User, 'id' | 'email'> | null, detalhe: Record<string, unknown> = {}) {
    await servico.from('auditoria').insert({
      dev_id: chamador!.id,
      dev_email: chamador!.email ?? null,
      acao,
      alvo_user_id: alvo?.id ?? null,
      alvo_email: alvo?.email ?? null,
      detalhe,
    })
  }

  async function carregarAlvo(): Promise<User> {
    const id = texto(corpo.user_id)
    if (!id) throw new ErroDeUso('Informe a conta.')
    const { data, error } = await servico.auth.admin.getUserById(id)
    if (error || !data.user) throw new ErroDeUso('Conta não encontrada.', 404)
    return data.user
  }

  function proibirPropriaConta(alvo: User, mensagem: string) {
    if (alvo.id === chamador!.id) throw new ErroDeUso(mensagem)
  }

  try {
    switch (acao) {
      case 'criar_conta': {
        const email = texto(corpo.email).toLowerCase()
        const senha = typeof corpo.senha === 'string' ? corpo.senha : ''
        const papel = validarPapel(texto(corpo.papel) || 'advogado')
        if (!EMAIL_VALIDO.test(email)) throw new ErroDeUso('Informe um e-mail válido.')
        validarSenha(senha)
        const { data, error } = await servico.auth.admin.createUser({
          email,
          password: senha,
          email_confirm: true,
          app_metadata: { app_role: papel },
        })
        if (error || !data.user) {
          throw new ErroDeUso(
            /already|registered|exists/i.test(error?.message ?? '')
              ? 'Já existe uma conta com esse e-mail.'
              : `Não foi possível criar a conta: ${error?.message ?? 'erro desconhecido'}`,
          )
        }
        await auditar(data.user, { papel })
        return responder({ ok: true, user_id: data.user.id })
      }

      case 'redefinir_senha': {
        const alvo = await carregarAlvo()
        const senha = typeof corpo.senha === 'string' ? corpo.senha : ''
        validarSenha(senha)
        const { error } = await servico.auth.admin.updateUserById(alvo.id, { password: senha })
        if (error) throw error
        await auditar(alvo)
        return responder({ ok: true })
      }

      case 'bloquear':
      case 'desbloquear': {
        const alvo = await carregarAlvo()
        proibirPropriaConta(alvo, 'Você não pode bloquear a própria conta.')
        const { error } = await servico.auth.admin.updateUserById(alvo.id, {
          ban_duration: acao === 'bloquear' ? BANIMENTO_PERMANENTE : 'none',
        })
        if (error) throw error
        await auditar(alvo)
        return responder({ ok: true })
      }

      case 'definir_papel': {
        const alvo = await carregarAlvo()
        const papel = validarPapel(texto(corpo.papel))
        if (papel !== 'dev') proibirPropriaConta(alvo, 'Você não pode remover o próprio acesso dev.')
        const { error } = await servico.auth.admin.updateUserById(alvo.id, {
          app_metadata: { ...alvo.app_metadata, app_role: papel },
        })
        if (error) throw error
        await auditar(alvo, { papel })
        return responder({ ok: true })
      }

      case 'excluir_conta': {
        const alvo = await carregarAlvo()
        proibirPropriaConta(alvo, 'Você não pode excluir a própria conta.')
        const { error } = await servico.auth.admin.deleteUser(alvo.id)
        if (error) throw error
        await auditar(alvo)
        return responder({ ok: true })
      }

      default:
        return responder({ erro: `Ação desconhecida: ${acao || '(vazia)'}.` }, 400)
    }
  } catch (erro) {
    if (erro instanceof ErroDeUso) return responder({ erro: erro.message }, erro.status)
    const mensagem = erro instanceof Error ? erro.message : String(erro)
    return responder({ erro: `Falha inesperada: ${mensagem}` }, 500)
  }
})
