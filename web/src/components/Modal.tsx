import { useEffect, type ReactNode } from 'react'

interface Props {
  titulo: ReactNode
  subtitulo?: ReactNode
  onFechar: () => void
  rodape?: ReactNode
  children: ReactNode
}

/** Diálogo central no desktop; no celular vira folha que sobe do rodapé (app-mobile.css). */
export default function Modal({ titulo, subtitulo, onFechar, rodape, children }: Props) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [onFechar])

  useEffect(() => {
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = anterior
    }
  }, [])

  return (
    <div
      className="ds-dialog-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar()
      }}
    >
      <div role="dialog" aria-modal="true" className="ds-dialog max-w-3xl max-md:max-w-none">
        <span className="ds-dialog-alca" aria-hidden />
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3 md:py-4">
          <div className="min-w-0">
            <h2 className="text-xl leading-tight font-bold text-navy md:text-2xl">{titulo}</h2>
            {subtitulo && <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">{subtitulo}</div>}
          </div>
          <button type="button" aria-label="Fechar" onClick={onFechar} className="ds-dialog-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
        {rodape && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3.5 max-md:[&>*]:flex-1">
            {rodape}
          </div>
        )}
      </div>
    </div>
  )
}
