import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type TipoToast } from '../lib/toast-context'

interface Toast {
  id: number
  mensagem: string
  tipo: TipoToast
}

const CORES: Record<TipoToast, string> = {
  info: 'bg-navy',
  ok: 'bg-ok',
  erro: 'bg-danger',
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const proximoId = useRef(1)

  const avisar = useCallback((mensagem: string, tipo: TipoToast = 'info') => {
    const id = proximoId.current++
    setToasts((atuais) => [...atuais, { id, mensagem, tipo }])
    setTimeout(
      () => setToasts((atuais) => atuais.filter((t) => t.id !== id)),
      tipo === 'erro' ? 7000 : 4500,
    )
  }, [])

  return (
    <ToastContext.Provider value={avisar}>
      {children}
      <div
        className="fixed right-5 bottom-5 z-[100] flex max-w-sm flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${CORES[t.tipo]} rounded-lg px-4 py-3 text-sm text-white shadow-lg`}
          >
            {t.mensagem}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
