import { useEffect, type ReactNode } from 'react'

interface Props {
  titulo: ReactNode
  subtitulo?: ReactNode
  onFechar: () => void
  rodape?: ReactNode
  children: ReactNode
}

export default function Modal({ titulo, subtitulo, onFechar, rodape, children }: Props) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [onFechar])

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,20,35,.5)] p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-navy">{titulo}</h2>
            {subtitulo && <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">{subtitulo}</div>}
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onFechar}
            className="cursor-pointer text-2xl leading-none text-muted hover:text-ink"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {rodape && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3.5">{rodape}</div>
        )}
      </div>
    </div>
  )
}
