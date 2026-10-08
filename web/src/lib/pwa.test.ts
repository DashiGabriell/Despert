import { describe, expect, it } from 'vitest'
import { eIos, modoInstalacao } from './pwa'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPAD_DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const ANDROID_FIREFOX = 'Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36'

describe('eIos', () => {
  it('reconhece iPhone e o iPad que se apresenta como Mac', () => {
    expect(eIos(IPHONE, 5)).toBe(true)
    expect(eIos(IPAD_DESKTOP, 5)).toBe(true)
  })

  it('não confunde Mac de mesa nem Windows', () => {
    expect(eIos(IPAD_DESKTOP, 0)).toBe(false)
    expect(eIos(WINDOWS, 0)).toBe(false)
  })
})

describe('modoInstalacao', () => {
  const base = { instalado: false, temAviso: false, userAgent: WINDOWS, toques: 0 }

  it('esconde o botão quando o app já está instalado, mesmo com aviso', () => {
    expect(modoInstalacao({ ...base, instalado: true, temAviso: true })).toBe('instalado')
  })

  it('usa o aviso nativo quando o navegador entrega', () => {
    expect(modoInstalacao({ ...base, temAviso: true })).toBe('nativo')
  })

  it('mostra o passo a passo no iPhone', () => {
    expect(modoInstalacao({ ...base, userAgent: IPHONE, toques: 5 })).toBe('ios')
  })

  it('cai no menu do navegador em celular sem aviso nativo', () => {
    expect(modoInstalacao({ ...base, userAgent: ANDROID_FIREFOX, toques: 5 })).toBe('manual')
  })

  it('não oferece instalação no computador sem aviso nativo', () => {
    expect(modoInstalacao(base)).toBe('indisponivel')
  })
})
