import type { ReactNode } from 'react'

export default function CartaoVazio({ titulo, descricao }: { titulo: string; descricao: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-card p-10 text-center shadow-sm">
      <h2 className="text-lg font-semibold text-navy">{titulo}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted">{descricao}</p>
    </section>
  )
}
