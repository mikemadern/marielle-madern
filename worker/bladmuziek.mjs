// POST /api/bladmuziek: stuurt de bladmuziek van een nummer per e-mail (Resend) naar de bezoeker.
// Geen opslag en geen logging van naam of e-mailadres: ze bestaan alleen in dit verzoek en in de mails.
// Alles wat van buiten komt (fetch, de lijst met nummers) wordt meegegeven, zodat de tests het kunnen nabootsen.
//
// Benodigd (Cloudflare, door de eigenaar ingesteld): secrets RESEND_API_KEY en TURNSTILE_SECRET, de R2-bucket
// met binding BLADMUZIEK (bestanden bladmuziek/<nummer>.pdf) en de twee limiet-bindingen uit wrangler.jsonc.
// Ontbreekt er één, dan geeft de Worker 503 en doet de feature niets.
import { ADRES_MARIELLE, AFZENDER, mailBezoeker, mailMarielle } from './teksten.mjs'

export const PAD = '/api/bladmuziek'
const MAX_VERZOEK = 4096
const MAX_PDF = 15 * 1024 * 1024
const RESEND = 'https://api.resend.com/emails'
const TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const EMAIL = /^[^\s@<>(),;:"\\]+@[^\s@<>(),;:"\\]+\.[^\s@<>(),;:"\\]+$/

const antwoord = (status, body = {}, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
      ...extra,
    },
  })

export const geconfigureerd = (env) =>
  Boolean(
    env.RESEND_API_KEY &&
    env.TURNSTILE_SECRET &&
    env.BLADMUZIEK &&
    env.LIMIET_ADRES &&
    env.LIMIET_ALGEMEEN,
  )

async function sha256(tekst) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tekst))
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function naarBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let tekst = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    tekst += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(tekst)
}

// Controleert de velden. Geeft { fout, veld } bij een fout, anders de schone waarden.
function controleer(invoer, lijst) {
  const naam =
    typeof invoer.naam === 'string'
      ? invoer.naam.replace(/\p{C}/gu, ' ').replace(/\s+/g, ' ').trim()
      : ''
  if (!naam || naam.length > 100) return { fout: 'ongeldig', veld: 'naam' }
  const email = typeof invoer.email === 'string' ? invoer.email.trim() : ''
  if (!email || email.length > 254 || !EMAIL.test(email)) return { fout: 'ongeldig', veld: 'email' }
  const nummer = typeof invoer.nummer === 'string' ? invoer.nummer : ''
  if (!/^[a-z0-9-]{1,80}$/.test(nummer) || !Object.hasOwn(lijst, nummer))
    return { fout: 'onbekend_nummer' }
  const token = typeof invoer.token === 'string' ? invoer.token : ''
  if (!token || token.length > 2048) return { fout: 'controle_mislukt' }
  return { naam, email, nummer, token, nieuwsbrief: invoer.nieuwsbrief === true }
}

async function stuurMail(env, deps, mail) {
  const res = await deps.fetch(RESEND, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: AFZENDER, ...mail }),
  })
  if (res.ok) return 'ok'
  // Daglimiet of maandlimiet van Resend: tijdelijk niet beschikbaar, niet een fout van de bezoeker
  return res.status === 429 ? 'limiet' : 'mislukt'
}

// Geeft een Response voor elk verzoek aan /api/..., en null voor al het andere.
export async function behandel(request, env, deps) {
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/api/')) return null
  if (url.pathname !== PAD) return antwoord(404, { fout: 'niet_gevonden' })
  if (request.method !== 'POST') return antwoord(405, { fout: 'methode' }, { allow: 'POST' })
  if (!geconfigureerd(env)) return antwoord(503, { fout: 'uitgeschakeld' })

  // Alleen vanaf onze eigen pagina's
  if (request.headers.get('origin') !== url.origin) return antwoord(403, { fout: 'verboden' })
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json'))
    return antwoord(415, { fout: 'inhoudstype' })
  if (Number(request.headers.get('content-length') ?? 0) > MAX_VERZOEK)
    return antwoord(413, { fout: 'te_groot' })

  let invoer
  try {
    const tekst = await request.text()
    if (tekst.length > MAX_VERZOEK) return antwoord(413, { fout: 'te_groot' })
    invoer = JSON.parse(tekst)
  } catch {
    return antwoord(400, { fout: 'ongeldig' })
  }
  if (invoer === null || typeof invoer !== 'object') return antwoord(400, { fout: 'ongeldig' })

  // Honeypot: een veld dat een mens niet ziet. Is het gevuld, dan doen we alsof het gelukt is en sturen niets.
  if (typeof invoer.website === 'string' && invoer.website !== '')
    return antwoord(200, { ok: true })

  const v = controleer(invoer, deps.lijst)
  if (v.fout)
    return antwoord(v.fout === 'onbekend_nummer' ? 404 : 400, {
      fout: v.fout,
      ...(v.veld ? { veld: v.veld } : {}),
    })

  // Turnstile (zonder het adres van de bezoeker door te geven)
  let controle
  try {
    const res = await deps.fetch(TURNSTILE, {
      method: 'POST',
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: v.token }),
    })
    controle = await res.json()
  } catch {
    return antwoord(503, { fout: 'tijdelijk_niet_beschikbaar' })
  }
  if (!controle?.success) return antwoord(400, { fout: 'controle_mislukt' })

  // Limieten per minuut: per adres (de sleutel is een hash, het adres zelf wordt niet bewaard) en voor de hele site
  const algemeen = await env.LIMIET_ALGEMEEN.limit({ key: 'algemeen' })
  const adres = await env.LIMIET_ADRES.limit({ key: await sha256(v.email.toLowerCase()) })
  if (!algemeen.success || !adres.success)
    return antwoord(429, { fout: 'te_vaak' }, { 'retry-after': '60' })

  // Het bestand komt uit de privé-bucket; de sleutel volgt uit de naam van het nummer, nooit uit de invoer zelf
  const bestand = await env.BLADMUZIEK.get(`bladmuziek/${v.nummer}.pdf`)
  if (!bestand) return antwoord(404, { fout: 'geen_bestand' })
  if (bestand.size > MAX_PDF) return antwoord(500, { fout: 'verzenden_mislukt' })
  const inhoud = naarBase64(await bestand.arrayBuffer())

  const titel = deps.lijst[v.nummer].titel
  const bezoeker = mailBezoeker({ naam: v.naam, titel, nieuwsbrief: v.nieuwsbrief })
  const uitslag = await stuurMail(env, deps, {
    to: [v.email],
    ...bezoeker,
    attachments: [{ filename: `bladmuziek-${v.nummer}.pdf`, content: inhoud }],
  })
  if (uitslag === 'limiet') return antwoord(503, { fout: 'tijdelijk_niet_beschikbaar' })
  if (uitslag !== 'ok') return antwoord(502, { fout: 'verzenden_mislukt' })

  // Nieuwsbrief: een mail aan Mariëlle met de naam en het adres (eerste versie, geen nieuwsbriefsoftware)
  let nieuwsbriefVerstuurd = false
  if (v.nieuwsbrief) {
    const aanvraag = mailMarielle({ naam: v.naam, email: v.email, titel, nieuwsbrief: true })
    nieuwsbriefVerstuurd =
      (await stuurMail(env, deps, { to: [ADRES_MARIELLE], reply_to: v.email, ...aanvraag })) ===
      'ok'
  }
  return antwoord(200, { ok: true, nieuwsbriefVerstuurd })
}
