import { useEffect, useRef, useState } from 'react'
import { deveMostrarSplash, modoApp } from '../lib/pwa'

const CHAVE_VISTO = 'despert:splash-visto'
const ESPERA_INICIO_MS = 3000
const LIMITE_TOTAL_MS = 12000
const SAIDA_MS = 350

function jaViuNestaAbertura(): boolean {
  try {
    return sessionStorage.getItem(CHAVE_VISTO) === '1'
  } catch {
    return true
  }
}

function marcarVisto(): void {
  try {
    sessionStorage.setItem(CHAVE_VISTO, '1')
  } catch {
    // storage bloqueado: no pior caso o splash repete
  }
}

/** Vídeo de abertura do app instalado; nunca segura o usuário se o vídeo falhar. */
export default function SplashVideo() {
  const [visivel, setVisivel] = useState(() =>
    deveMostrarSplash({
      instalado: modoApp(),
      jaViu: jaViuNestaAbertura(),
      reduzMovimento: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
    }),
  )
  const [saindo, setSaindo] = useState(false)
  const [tocando, setTocando] = useState(false)
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!visivel) return
    marcarVisto()
    // Modo Pouca Energia do iOS e políticas de autoplay rejeitam o play()
    Promise.resolve()
      .then(() => {
        const atual = video.current
        if (!atual) return
        // iOS só libera autoplay mudo; o React não reflete o atributo muted
        atual.muted = true
        atual.defaultMuted = true
        return atual.play()
      })
      .catch(() => setSaindo(true))
    const limite = window.setTimeout(() => setSaindo(true), LIMITE_TOTAL_MS)
    return () => window.clearTimeout(limite)
  }, [visivel])

  useEffect(() => {
    if (!visivel || tocando) return
    const espera = window.setTimeout(() => setSaindo(true), ESPERA_INICIO_MS)
    return () => window.clearTimeout(espera)
  }, [visivel, tocando])

  useEffect(() => {
    if (!saindo) return
    const fim = window.setTimeout(() => setVisivel(false), SAIDA_MS)
    return () => window.clearTimeout(fim)
  }, [saindo])

  if (!visivel) return null

  return (
    <div className="splash-video" data-saindo={saindo || undefined}>
      <video
        ref={video}
        src="/splash.mp4"
        muted
        playsInline
        autoPlay
        preload="auto"
        aria-hidden="true"
        onPlaying={() => setTocando(true)}
        onEnded={() => setSaindo(true)}
        onError={() => setSaindo(true)}
      />
      <button type="button" className="splash-pular" onClick={() => setSaindo(true)}>
        Pular
      </button>
    </div>
  )
}
