import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { alertaAviso, alertaErro, alertaOk, botao, botaoPrimario, campo, rotulo } from '../components/ui'
import { chaves, cliente } from '../data/queries'
import { ROTULO_PAPEL } from '../domain/equipe'
import { chaveOrganizacaoPreferida } from '../domain/organizacao'
import { useAuth } from '../lib/auth-context'
import type { ResumoConvite } from '../lib/database.types'
import { supabase } from '../lib/supabase'
import { mensagemDeErro } from '../lib/toast-context'

function Moldura({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-secondary/40 p-5">
      <div className="ds-card ds-entrar w-full max-w-md p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <img src="/logo-despert-256.png" alt="Despert" className="size-12 shrink-0 object-contain" />
          <span className="font-display text-2xl font-bold text-navy">Despert</span>
        </div>
        {children}
      </div>
    </main>
  )
}

/** Página do link do convite: mostra para onde é, cria a conta ou entra, e aceita (#18). */
export default function Convite() {
  const { token = '' } = useParams()
  const { sessao } = useAuth()
  const resumo = useQuery({
    queryKey: ['convite', token],
    queryFn: async (): Promise<ResumoConvite | null> => {
      const { data, error } = await cliente().rpc('ver_convite', { codigo: token })
      if (error) throw error
      return data[0] ?? null
    },
  })

  if (resumo.isPending || sessao === undefined) {
    return <Moldura>Carregando…</Moldura>
  }
  if (resumo.isError) {
    return (
      <Moldura>
        <div role="alert" className={alertaErro}>
          Não foi possível abrir o convite: {mensagemDeErro(resumo.error)}
        </div>
      </Moldura>
    )
  }
  const convite = resumo.data
  if (!convite) {
    return (
      <Moldura>
        <h1 className="mb-2 text-2xl font-bold text-navy">Convite não encontrado</h1>
        <p className="text-sm text-muted">O link pode ter sido cancelado. Peça um novo ao Administrador da equipe.</p>
      </Moldura>
    )
  }
  if (convite.situacao !== 'pendente') {
    return (
      <Moldura>
        <h1 className="mb-2 text-2xl font-bold text-navy">
          {convite.situacao === 'expirado' ? 'Convite expirado' : 'Convite já usado'}
        </h1>
        <p className="mb-4 text-sm text-muted">
          {convite.situacao === 'expirado'
            ? 'Este convite passou da validade de 7 dias. Peça ao Administrador para reenviá-lo.'
            : 'Este convite já foi aceito. Entre normalmente para acessar a equipe.'}
        </p>
        <Link to="/login" className={botao}>
          Ir para o login
        </Link>
      </Moldura>
    )
  }

  return (
    <Moldura>
      <h1 className="mb-1 text-2xl font-bold text-navy">Convite para {convite.organizacao || 'uma equipe'}</h1>
      <p className="mb-5 text-sm text-muted">
        Você foi convidado(a) como <strong className="text-ink">{ROTULO_PAPEL[convite.papel]}</strong>, com o e-mail{' '}
        <strong className="text-ink">{convite.email}</strong>.
      </p>
      {sessao ? <Aceitar token={token} convite={convite} /> : <Entrar token={token} email={convite.email} />}
    </Moldura>
  )
}

function Aceitar({ token, convite }: { token: string; convite: ResumoConvite }) {
  const { sessao, sair } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = sessao?.user.id ?? ''
  const aceitar = useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await cliente().rpc('aceitar_convite', { codigo: token })
      if (error) throw error
      return data
    },
    onSuccess: async (orgId) => {
      localStorage.setItem(chaveOrganizacaoPreferida(userId), orgId)
      await queryClient.invalidateQueries({ queryKey: chaves.pertencas(userId) })
      navigate('/prazos', { replace: true })
    },
  })

  if ((sessao?.user.email ?? '').toLowerCase() !== convite.email) {
    return (
      <>
        <div className={`${alertaAviso} mb-4`}>
          Você está conectado(a) como <strong>{sessao?.user.email}</strong>. Este convite é para{' '}
          <strong>{convite.email}</strong>: saia e entre com essa conta.
        </div>
        <button type="button" className={botao} onClick={() => void sair()}>
          Sair
        </button>
      </>
    )
  }
  return (
    <>
      {aceitar.isError && (
        <div role="alert" className={`${alertaErro} mb-4`}>
          {mensagemDeErro(aceitar.error)}
        </div>
      )}
      <button
        type="button"
        className={`${botaoPrimario} w-full`}
        disabled={aceitar.isPending}
        onClick={() => aceitar.mutate()}
      >
        {aceitar.isPending ? 'Aguarde…' : 'Aceitar convite'}
      </button>
    </>
  )
}

function Entrar({ token, email }: { token: string; email: string }) {
  const [modo, setModo] = useState<'criar' | 'entrar'>('criar')
  const [senha, setSenha] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setErro(null)
    setAviso(null)
    if (modo === 'criar' && senha.length < 8) {
      setErro('Use uma senha com pelo menos 8 caracteres.')
      return
    }
    setOcupado(true)
    if (modo === 'entrar') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) setErro('Senha inválida para este e-mail.')
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { emailRedirectTo: `${window.location.origin}/convite/${token}` },
      })
      if (error) {
        setErro(
          error.code === 'user_already_exists'
            ? 'Já existe uma conta com este e-mail: escolha "Já tenho conta".'
            : `Não foi possível criar a conta: ${error.message}`,
        )
      } else if (!data.session) {
        setAviso('Conta criada. Confirme pelo link que enviamos para o seu e-mail; ele traz você de volta para aceitar.')
      }
    }
    setOcupado(false)
  }

  return (
    <form onSubmit={enviar} noValidate aria-label={modo === 'criar' ? 'Criar conta' : 'Entrar'}>
      {erro && (
        <div role="alert" className={`${alertaErro} mb-4`}>
          {erro}
        </div>
      )}
      {aviso && <div className={`${alertaOk} mb-4`}>{aviso}</div>}
      <div className="mb-4">
        <label className={rotulo} htmlFor="convite-senha">
          {modo === 'criar' ? 'Crie uma senha' : 'Sua senha'}
        </label>
        <input
          id="convite-senha"
          type="password"
          autoComplete={modo === 'criar' ? 'new-password' : 'current-password'}
          className={campo}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
      </div>
      <button type="submit" className={`${botaoPrimario} w-full`} disabled={ocupado || !supabase}>
        {ocupado ? 'Aguarde…' : modo === 'criar' ? 'Criar conta' : 'Entrar'}
      </button>
      <p className="mt-4 text-center text-sm text-muted">
        <button
          type="button"
          className="cursor-pointer font-semibold text-primary underline underline-offset-2"
          onClick={() => {
            setModo(modo === 'criar' ? 'entrar' : 'criar')
            setErro(null)
            setAviso(null)
          }}
        >
          {modo === 'criar' ? 'Já tenho conta' : 'Ainda não tenho conta'}
        </button>
      </p>
    </form>
  )
}
