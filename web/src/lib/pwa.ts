import { useSyncExternalStore } from 'react'

/** aberto pelo ícone da tela inicial (PWA instalado), sem barra do navegador */
export function modoApp(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true
}

/** como o botão "Instalar o app" deve se comportar neste aparelho:
 *  nativo  - o navegador entregou o aviso de instalação (Chrome/Edge/Samsung)
 *  ios     - iPhone/iPad: só dá para instalar pelo Compartilhar > Tela de Início
 *  manual  - celular sem aviso nativo: instalar pelo menu do navegador
 *  instalado / indisponivel - o botão não aparece */
export type ModoInstalacao = 'instalado' | 'nativo' | 'ios' | 'manual' | 'indisponivel'

export function eIos(userAgent: string, toques: number): boolean {
  // iPadOS se apresenta como Macintosh; a tela de toque denuncia
  return /iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && toques > 1)
}

export function modoInstalacao(sinais: {
  instalado: boolean
  temAviso: boolean
  userAgent: string
  toques: number
}): ModoInstalacao {
  if (sinais.instalado) return 'instalado'
  if (sinais.temAviso) return 'nativo'
  if (eIos(sinais.userAgent, sinais.toques)) return 'ios'
  if (/android|mobi/i.test(sinais.userAgent)) return 'manual'
  return 'indisponivel'
}

type AvisoInstalacao = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let aviso: AvisoInstalacao | null = null
let acabouDeInstalar = false
let modoAtual: ModoInstalacao = 'indisponivel'
let ouvindo = false
const ouvintes = new Set<() => void>()

function recalcular() {
  const novo = modoInstalacao({
    instalado: acabouDeInstalar || modoApp(),
    temAviso: aviso !== null,
    userAgent: navigator.userAgent,
    toques: navigator.maxTouchPoints ?? 0,
  })
  if (novo === modoAtual) return
  modoAtual = novo
  ouvintes.forEach((avisar) => avisar())
}

/** o aviso nativo pode chegar antes do React montar: chame logo na carga */
export function iniciarInstalacao(): void {
  if (ouvindo || typeof window === 'undefined') return
  ouvindo = true

  window.addEventListener('beforeinstallprompt', (evento) => {
    evento.preventDefault()
    aviso = evento as AvisoInstalacao
    recalcular()
  })
  window.addEventListener('appinstalled', () => {
    aviso = null
    acabouDeInstalar = true
    recalcular()
  })
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', recalcular)
  recalcular()
}

/** abre a janela nativa; devolve true se o usuário aceitou */
export async function instalarApp(): Promise<boolean> {
  const atual = aviso
  if (!atual) return false
  // o mesmo aviso não pode ser reaproveitado depois de exibido
  aviso = null
  await atual.prompt()
  const { outcome } = await atual.userChoice
  recalcular()
  return outcome === 'accepted'
}

function assinarInstalacao(avisar: () => void) {
  iniciarInstalacao()
  ouvintes.add(avisar)
  return () => {
    ouvintes.delete(avisar)
  }
}

export function useInstalacao(): ModoInstalacao {
  return useSyncExternalStore(
    assinarInstalacao,
    () => modoAtual,
    () => 'indisponivel',
  )
}

export function registrarServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}
