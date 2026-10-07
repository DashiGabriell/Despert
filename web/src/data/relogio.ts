import { useEffect, useState } from 'react'
import { hojeISO } from '../domain/datas'
import type { DataISO } from '../domain/dias'

/** Instante atual em ms, atualizado a cada `intervaloMs` enquanto `ativo`. */
export function useAgora(intervaloMs: number, ativo = true): number {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (!ativo) return
    const id = setInterval(() => setAgora(Date.now()), intervaloMs)
    return () => clearInterval(id)
  }, [intervaloMs, ativo])
  return agora
}

/** A data de hoje em Brasília, virando sozinha à meia-noite. */
export function useHoje(): DataISO {
  const agora = useAgora(60_000)
  return hojeISO(new Date(agora))
}
