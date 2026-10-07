import type { AuthError } from '@supabase/supabase-js'
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { alertaAviso, alertaErro, alertaOk, botaoPrimario, campo, rotulo } from '../components/ui'
import { useAuth } from '../lib/auth-context'
import { ausenciaConfiguracao, supabase } from '../lib/supabase'

type Modo = 'entrar' | 'criar'

function mensagemDeLogin(erro: AuthError): string {
  if (erro.code === 'email_not_confirmed') {
    return 'Confirme seu e-mail pelo link que enviamos antes de entrar.'
  }
  if (erro.status === 0 || erro.name === 'AuthRetryableFetchError') {
    return 'Não foi possível conectar ao servidor. Verifique sua internet e tente de novo.'
  }
  return 'E-mail ou senha inválidos.'
}

export default function Login() {
  const { sessao } = useAuth()
  const [modo, setModo] = useState<Modo>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  if (sessao) return <Navigate to="/prazos" replace />

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
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
      if (error) setErro(mensagemDeLogin(error))
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) {
        setErro(
          error.code === 'weak_password'
            ? 'Senha fraca: use letras e números, com pelo menos 8 caracteres.'
            : `Não foi possível criar a conta: ${error.message}`,
        )
      } else if (!data.session) {
        setAviso(
          'Conta criada. Enviamos um link de confirmação para o seu e-mail; depois de confirmar, entre com a sua senha.',
        )
        setModo('entrar')
      }
    }
    setOcupado(false)
  }

  return (
    <main className="grid min-h-dvh place-items-center p-5">
      <form
        onSubmit={enviar}
        className="ds-card ds-entrar w-full max-w-sm p-8"
        aria-label={modo === 'entrar' ? 'Entrar' : 'Criar conta'}
      >
        <div className="mb-7 flex items-center gap-3">
          <span className="ds-marca size-10 text-2xl">D</span>
          <span>
            <span className="block font-display text-3xl leading-tight font-bold text-navy">Despert</span>
            <span className="block text-[11px] tracking-wider text-muted uppercase">Monitor de prazos · DJEN</span>
          </span>
        </div>

        <h1 className="mb-1 text-3xl leading-tight font-bold text-navy">
          {modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </h1>
        <p className="mb-5 text-sm text-muted">
          {modo === 'entrar'
            ? 'Acesse seus prazos do Diário de Justiça Eletrônico Nacional.'
            : 'Cada conta vê apenas os próprios processos e prazos.'}
        </p>

        {ausenciaConfiguracao && <div className={`${alertaAviso} mb-4`}>{ausenciaConfiguracao}</div>}
        {erro && (
          <div role="alert" className={`${alertaErro} mb-4`}>
            {erro}
          </div>
        )}
        {aviso && <div className={`${alertaOk} mb-4`}>{aviso}</div>}

        <div className="mb-3.5">
          <label className={rotulo} htmlFor="login-email">
            E-mail
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            required
            className={campo}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="mb-5">
          <label className={rotulo} htmlFor="login-senha">
            Senha
          </label>
          <input
            id="login-senha"
            type="password"
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            required
            className={campo}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className={`${botaoPrimario} w-full`}
          disabled={ocupado || !supabase}
        >
          {ocupado ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </button>
        <p className="mt-5 text-center text-sm text-muted">
          {modo === 'entrar' ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
          <button
            type="button"
            className="cursor-pointer font-semibold text-primary underline underline-offset-2"
            onClick={() => {
              setModo(modo === 'entrar' ? 'criar' : 'entrar')
              setErro(null)
              setAviso(null)
            }}
          >
            {modo === 'entrar' ? 'Criar conta' : 'Entrar'}
          </button>
        </p>
      </form>
    </main>
  )
}
