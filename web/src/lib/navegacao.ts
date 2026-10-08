import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

export const ICONE_SAIR = 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'
export const ICONE_MAIS = 'M4 6h16M4 12h16M4 18h16'
export const ICONE_INSTALAR = 'M12 3v12M7 10l5 5 5-5M5 21h14'

/** Trocar de aba abre a tela nova no topo; voltar (POP) preserva onde o usuário estava. */
export function useRolagemAoTopo() {
  const { pathname } = useLocation()
  const tipo = useNavigationType()
  useEffect(() => {
    if (tipo !== 'POP') window.scrollTo({ top: 0 })
  }, [pathname, tipo])
}
