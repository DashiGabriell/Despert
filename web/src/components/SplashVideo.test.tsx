import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SplashVideo from './SplashVideo'

const matchMediaOriginal = window.matchMedia

function simularTela({ instalado, reduzMovimento = false }: { instalado: boolean; reduzMovimento?: boolean }) {
  window.matchMedia = ((consulta: string) => ({
    matches: (consulta.includes('standalone') && instalado) || (consulta.includes('reduced-motion') && reduzMovimento),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia
}

function montar() {
  const { container } = render(<SplashVideo />)
  return container
}

beforeEach(() => {
  sessionStorage.clear()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
})

afterEach(() => {
  window.matchMedia = matchMediaOriginal
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('SplashVideo', () => {
  it('não aparece no navegador comum', () => {
    simularTela({ instalado: false })
    expect(montar().querySelector('.splash-video')).toBeNull()
  })

  it('não aparece para quem pediu menos movimento', () => {
    simularTela({ instalado: true, reduzMovimento: true })
    expect(montar().querySelector('.splash-video')).toBeNull()
  })

  it('toca mudo e inline, e Pular encerra', async () => {
    vi.useFakeTimers()
    simularTela({ instalado: true })
    const tela = montar()
    const video = tela.querySelector('video')
    await act(async () => undefined)
    expect(video?.muted).toBe(true)
    expect(video).toHaveAttribute('playsinline')
    expect(sessionStorage.getItem('despert:splash-visto')).toBe('1')

    await act(async () => screen.getByRole('button', { name: 'Pular' }).click())
    expect(tela.querySelector('.splash-video')).toHaveAttribute('data-saindo')
    await act(async () => vi.advanceTimersByTime(400))
    expect(tela.querySelector('.splash-video')).toBeNull()
  })

  it('não repete na mesma abertura', () => {
    simularTela({ instalado: true })
    sessionStorage.setItem('despert:splash-visto', '1')
    expect(montar().querySelector('.splash-video')).toBeNull()
  })

  it('sai sozinho quando o autoplay é bloqueado', async () => {
    vi.useFakeTimers()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('NotAllowedError'))
    simularTela({ instalado: true })
    const tela = montar()
    await act(async () => undefined)
    expect(tela.querySelector('.splash-video')).toHaveAttribute('data-saindo')
    await act(async () => vi.advanceTimersByTime(400))
    expect(tela.querySelector('.splash-video')).toBeNull()
  })

  it('sai sozinho se o vídeo não começar em 3 segundos', async () => {
    vi.useFakeTimers()
    simularTela({ instalado: true })
    const tela = montar()
    await act(async () => vi.advanceTimersByTime(3000))
    expect(tela.querySelector('.splash-video')).toHaveAttribute('data-saindo')
    await act(async () => vi.advanceTimersByTime(400))
    expect(tela.querySelector('.splash-video')).toBeNull()
  })
})
