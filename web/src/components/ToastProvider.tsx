import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type TipoToast } from '../lib/toast-context'

interface Toast {
  id: number
  mensagem: string
  tipo: TipoToast
}

const ICONES: Record<TipoToast, { simbolo: string; cor: string }> = {
  info: { simbolo: 'i', cor: 'bg-white/15 text-white' },
  ok: { simbolo: '✓', cor: 'bg-ok text-white' },
  erro: { simbolo: '!', cor: 'bg-danger text-white' },
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
        className="fixed inset-x-3 top-[calc(var(--safe-top)+0.75rem)] z-[100] flex flex-col gap-2 md:inset-x-auto md:top-auto md:right-5 md:bottom-5 md:max-w-sm"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div key={t.id} className="ds-toast">
            <span
              aria-hidden
              className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${ICONES[t.tipo].cor}`}
            >
              {ICONES[t.tipo].simbolo}
            </span>
            <span>{t.mensagem}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
