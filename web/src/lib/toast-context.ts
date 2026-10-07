import { createContext, useContext } from 'react'

export type TipoToast = 'info' | 'ok' | 'erro'

export type Avisar = (mensagem: string, tipo?: TipoToast) => void

export const ToastContext = createContext<Avisar>(() => {})

export function useToast(): Avisar {
  return useContext(ToastContext)
}

/** Mensagem legível de um erro do Supabase ou de rede. */
export function mensagemDeErro(erro: unknown): string {
  if (erro && typeof erro === 'object' && 'message' in erro && typeof erro.message === 'string') {
    return erro.message
  }
  return String(erro)
}
