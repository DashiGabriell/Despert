/*
 * Service worker do Despert.
 * Guarda só o "casco" do app (HTML, JS/CSS com hash, ícones e fontes) para abrir
 * instantâneo e funcionar sem rede. Dados (Supabase, n8n) nunca passam pelo cache:
 * qualquer requisição de outra origem que não seja fonte segue direto para a rede.
 */
const VERSAO = 'despert-v1'
const CASCO = `${VERSAO}-casco`
const RUNTIME = `${VERSAO}-runtime`
const PRECACHE = [
  '/index.html',
  '/manifest.webmanifest',
  '/logo-despert-256.png',
  '/icons/icon-192.png',
  '/icons/apple-touch-icon.png',
]
const FONTES = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com']

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CASCO)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(chaves.filter((c) => !c.startsWith(VERSAO)).map((c) => caches.delete(c))),
      )
      .then(() => self.clients.claim()),
  )
})

async function redePrimeiro(req) {
  const cache = await caches.open(CASCO)
  try {
    const resp = await fetch(req)
    if (resp.ok) cache.put('/index.html', resp.clone())
    return resp
  } catch {
    return (await cache.match('/index.html')) ?? Response.error()
  }
}

async function cachePrimeiro(req) {
  const cache = await caches.open(RUNTIME)
  const salvo = await cache.match(req)
  if (salvo) return salvo
  const resp = await fetch(req)
  if (resp.ok || resp.type === 'opaque') cache.put(req, resp.clone())
  return resp
}

async function revalidarEmSegundoPlano(req) {
  const cache = await caches.open(RUNTIME)
  const salvo = await cache.match(req)
  const rede = fetch(req)
    .then((resp) => {
      if (resp.ok) cache.put(req, resp.clone())
      return resp
    })
    .catch(() => salvo)
  return salvo ?? rede
}

self.addEventListener('fetch', (evento) => {
  const req = evento.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  if (FONTES.includes(url.origin)) {
    evento.respondWith(cachePrimeiro(req))
    return
  }
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    evento.respondWith(redePrimeiro(req))
    return
  }
  if (url.pathname.startsWith('/assets/')) {
    evento.respondWith(cachePrimeiro(req))
    return
  }
  if (url.pathname === '/sw.js') return
  evento.respondWith(revalidarEmSegundoPlano(req))
})

self.addEventListener('message', (evento) => {
  if (evento.data === 'pular-espera') self.skipWaiting()
})
