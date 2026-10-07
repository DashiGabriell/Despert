import CartaoVazio from '../components/CartaoVazio'
import { ausenciaConfiguracao } from '../lib/supabase'

export default function Login() {
  return (
    <main className="grid min-h-dvh place-items-center bg-navy p-5">
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-gold font-bold text-white">
            D
          </span>
          <span>
            <span className="block text-lg font-bold text-navy">Despert</span>
            <span className="block text-xs text-muted">Monitor de prazos · DJEN</span>
          </span>
        </div>
        <CartaoVazio
          titulo="Login"
          descricao={
            <>
              Tela de e-mail e senha com Supabase Auth, entrega do ticket de login.
              {ausenciaConfiguracao ? ' Enquanto isso, o Supabase não está configurado.' : ''}
            </>
          }
        />
      </div>
    </main>
  )
}
