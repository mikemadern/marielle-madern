// Gedeelde stappen van de eindpunten van de Worker (bladmuziek en contact): antwoorden, hostcontrole, het verzoek
// lezen en controleren, Turnstile, limieten en Resend. Geen opslag en geen logging van gegevens van bezoekers.

export const RESEND = 'https://api.resend.com/emails'
export const TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
export const EMAIL = /^[^\s@<>(),;:"\\]+@[^\s@<>(),;:"\\]+\.[^\s@<>(),;:"\\]+$/

// Alleen op deze adressen doet de Worker iets. Een preview-adres en het gewone workers.dev-adres krijgen 403,
// ook als de Turnstile-widget ze toestaat (dat hangt dus niet af van een instelling van de eigenaar). Een
// code-constante: het echte domein en www kunnen niet per ongeluk uit een instelling verdwijnen. Bewust uitbreiden
// kan met de optionele, niet-geheime variabele TOEGESTANE_HOSTS (komma-gescheiden hostnamen, exact, geen wildcard):
// die staat in wrangler.jsonc ("vars"), want de Worker wordt vanuit dat bestand beheerd en Cloudflare staat
// variabelen in het dashboard dan niet toe; zie de README.
export const TOEGESTANE_HOSTS = ['mariellemadern.nl', 'www.mariellemadern.nl']

export const hostToegestaan = (env, hostname) =>
  [
    ...TOEGESTANE_HOSTS,
    ...String(env.TOEGESTANE_HOSTS ?? '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  ].includes(hostname.toLowerCase())

export const antwoord = (status, body = {}, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
      'x-content-type-options': 'nosniff',
      ...extra,
    },
  })

// Sleutel voor een limiet: een HMAC (met het Turnstile-geheim als sleutel) van het adres of het IP-adres, in hex.
// Zo staat het adres zelf nergens en is de sleutel niet terug te rekenen door iemand zonder het geheim.
// De limiet-binding houdt alleen een teller in het geheugen bij; er wordt niets bewaard of gelogd.
export async function limietSleutel(env, tekst) {
  const sleutel = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.TURNSTILE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const hash = await crypto.subtle.sign('HMAC', sleutel, new TextEncoder().encode(tekst))
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Leest de body gestreamd en stopt zodra hij groter is dan het maximum (geeft dan null)
export async function leesBeperkt(request, max) {
  if (!request.body) return ''
  const lezer = request.body.getReader()
  const stukken = []
  let totaal = 0
  for (;;) {
    const { done, value } = await lezer.read()
    if (done) break
    totaal += value.byteLength
    if (totaal > max) {
      await lezer.cancel()
      return null
    }
    stukken.push(value)
  }
  return new TextDecoder().decode(await new Blob(stukken).arrayBuffer())
}

// Controleert herkomst, inhoudstype en grootte en leest de JSON. Geeft { antwoord } bij een fout, anders { invoer }.
export async function leesJson(request, url, max) {
  // Eenvoudig filter tegen gebruik vanaf andere pagina's in een browser (geen verificatie, zie boven)
  if (request.headers.get('origin') !== url.origin)
    return { antwoord: antwoord(403, { fout: 'verboden' }) }
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json'))
    return { antwoord: antwoord(415, { fout: 'inhoudstype' }) }
  if (Number(request.headers.get('content-length') ?? 0) > max)
    return { antwoord: antwoord(413, { fout: 'te_groot' }) }
  let invoer
  try {
    // Gestreamd en met een maximum, ook als er geen content-length is
    const tekst = await leesBeperkt(request, max)
    if (tekst === null) return { antwoord: antwoord(413, { fout: 'te_groot' }) }
    invoer = JSON.parse(tekst)
  } catch {
    return { antwoord: antwoord(400, { fout: 'ongeldig' }) }
  }
  if (invoer === null || typeof invoer !== 'object')
    return { antwoord: antwoord(400, { fout: 'ongeldig' }) }
  return { invoer }
}

// Turnstile (zonder het adres van de bezoeker door te geven). Geeft null als het klopt, anders een antwoord.
// Het token moet voor onze eigen hostname en voor deze actie zijn uitgegeven (anders kan een token van een
// andere site, met een eigen widget, of van het andere formulier hier worden gebruikt). Ontbreekt een van de
// twee in het antwoord van Turnstile: weigeren.
export async function controleerTurnstile(env, deps, token, url, actie) {
  let controle
  try {
    const res = await deps.fetch(TURNSTILE, {
      method: 'POST',
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token }),
    })
    controle = await res.json()
  } catch {
    return antwoord(503, { fout: 'tijdelijk_niet_beschikbaar' })
  }
  if (!controle?.success || controle.hostname !== url.hostname || controle.action !== actie)
    return antwoord(400, { fout: 'controle_mislukt' })
  return null
}

// Limieten per minuut, in de gegeven volgorde en met een vroege stop (een geblokkeerd verzoek telt niet mee voor de
// volgende limiet). Elke regel is [limiet-binding, tekst]; tekst null is de limiet voor de hele site. Geeft true als
// een limiet is bereikt.
export async function teVaak(env, regels) {
  for (const [limiet, tekst] of regels) {
    const sleutel = tekst === null ? 'algemeen' : await limietSleutel(env, tekst)
    if (!(await limiet.limit({ key: sleutel })).success) return true
  }
  return false
}

export async function stuurMail(env, deps, mail, afzender) {
  const res = await deps.fetch(RESEND, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: afzender, ...mail }),
  })
  if (res.ok) return 'ok'
  // Daglimiet of maandlimiet van Resend: tijdelijk niet beschikbaar, niet een fout van de bezoeker
  return res.status === 429 ? 'limiet' : 'mislukt'
}
