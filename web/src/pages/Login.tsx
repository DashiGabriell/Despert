import type { AuthError } from '@supabase/supabase-js'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import BotaoInstalarApp from '../components/InstalarApp'
import { alertaAviso, alertaErro, alertaOk, botaoPrimario, campo, rotulo } from '../components/ui'
import { rotaInicial } from '../domain/acesso'
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
  const { sessao, papel, atuacao } = useAuth()
  const [parametros] = useSearchParams()
  const [modo, setModo] = useState<Modo>(parametros.has('criar') ? 'criar' : 'entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  if (sessao) return <Navigate to={rotaInicial(papel, atuacao !== null)} replace />

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
    <main className="relative isolate grid min-h-dvh place-items-center overflow-hidden p-5 max-md:items-end max-md:p-0 max-md:pt-[calc(var(--safe-top)+5rem)]">
      {/* scale-105 esconde as bordas claras que o blur cria nas extremidades da imagem */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 scale-105 bg-[url(/bg-login-mobile.webp)] bg-cover bg-center blur-[3px] md:bg-[url(/bg-login-desktop.webp)]"
      />
      <form
        onSubmit={enviar}
        className="ds-card ds-entrar w-full max-w-sm p-8 shadow-2xl max-md:max-w-none max-md:animate-[app-folha-sobe_0.45s_cubic-bezier(0.22,1,0.36,1)_both] max-md:rounded-t-[28px] max-md:rounded-b-none max-md:border-0 max-md:px-6 max-md:pt-3 max-md:pb-[calc(1.75rem+var(--safe-bottom))] motion-reduce:animate-none"
        aria-label={modo === 'entrar' ? 'Entrar' : 'Criar conta'}
      >
        <span aria-hidden className="mx-auto mb-5 block h-[5px] w-10 rounded-full bg-muted/35 md:hidden" />
        <Link to="/" className="mb-6 flex items-center gap-3 md:mb-7" aria-label="Despert, página inicial">
          <img src="/logo-despert-256.png" alt="" className="size-14 shrink-0 object-contain md:size-16" />
          <span aria-hidden>
            <span className="block font-display text-3xl leading-tight font-bold text-navy">Despert</span>
            <span className="block text-[11px] tracking-wider text-muted uppercase">Monitor de prazos · DJEN</span>
          </span>
        </Link>

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
        <BotaoInstalarApp estilo="botao" className="mt-5 w-full md:hidden" />
      </form>
    </main>
  )
}
