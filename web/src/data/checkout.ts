import { FunctionsHttpError } from '@supabase/supabase-js'
import { useMutation } from '@tanstack/react-query'
import type { Plano } from '../lib/database.types'
import { cliente } from './queries'

export function abrirPagamento(url: string) {
  window.location.assign(url)
}

export function useContratar() {
  return useMutation({
    mutationFn: async (pedido: { organizacaoId: string; plano: Plano }): Promise<string> => {
      const { data, error } = await cliente().functions.invoke('asaas-checkout', { body: pedido })
      if (!error) {
        if (data && typeof data === 'object' && 'url' in data && typeof data.url === 'string') return data.url
        throw new Error('Não foi possível abrir o pagamento.')
      }
      if (error instanceof FunctionsHttpError) {
        const corpo: unknown = await error.context.json().catch(() => null)
        if (corpo && typeof corpo === 'object' && 'erro' in corpo && typeof corpo.erro === 'string') {
          throw new Error(corpo.erro)
        }
      }
      throw new Error('Não foi possível abrir o pagamento.')
    },
  })
}
