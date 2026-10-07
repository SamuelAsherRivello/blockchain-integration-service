const origin = process.env.SLIDEV_PREVIEW_ORIGIN ?? 'http://localhost:3032'

async function fetchSuccess(url) {
  const response = await fetch(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  return response
}

const landing = await fetchSuccess(`${origin}/`)
const html = await landing.text()
const links = [...html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)]
  .map((match) => new URL(match[1], `${origin}/`))
  .filter((url) => url.origin === origin)

if (!links.length) throw new Error(`The landing page at ${origin}/ contains no internal links.`)

const results = []
for (const link of links) {
  const response = await fetchSuccess(link)
  results.push({ path: `${link.pathname}${link.search}`, status: response.status })
}

process.stdout.write(`${JSON.stringify({ ok: true, landing: { path: '/', status: landing.status }, links: results })}\n`)
