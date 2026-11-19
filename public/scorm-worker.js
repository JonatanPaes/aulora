const prefix = new URL('./__scorm/', self.registration.scope).pathname

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(prefix)) return
  if (event.request.method !== 'GET' && event.request.method !== 'HEAD') return

  event.respondWith(serveFile(url, event.request))
})

async function serveFile(url, request) {
  const id = url.pathname.slice(prefix.length).split('/')[0]
  if (!/^[a-f0-9-]{36}$/.test(id)) return new Response(null, { status: 404 })

  const response = await caches.match(url.href, { cacheName: `scorm-${id}`, ignoreSearch: true })
  if (!response) return new Response('Arquivo ausente no pacote SCORM.', { status: 404 })

  const range = request.headers.get('range')
  if (request.method === 'HEAD') return new Response(null, { headers: response.headers })
  if (!range) return response

  const match = /^bytes=(\d*)-(\d*)$/.exec(range)
  if (!match || (!match[1] && !match[2])) return response

  const file = await response.blob()
  const start = match[1] ? Number(match[1]) : Math.max(0, file.size - Number(match[2]))
  const end = match[1] && match[2] ? Math.min(Number(match[2]), file.size - 1) : file.size - 1
  if (start > end || start >= file.size) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${file.size}` } })
  }

  const headers = new Headers(response.headers)
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Content-Range', `bytes ${start}-${end}/${file.size}`)
  headers.set('Content-Length', String(end - start + 1))
  return new Response(file.slice(start, end + 1), { status: 206, headers })
}

