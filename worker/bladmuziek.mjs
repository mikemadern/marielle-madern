// POST /api/bladmuziek: stuurt de bladmuziek van een nummer per e-mail (Resend) naar de bezoeker.
// Geen opslag en geen logging van naam of e-mailadres: ze bestaan alleen in dit verzoek en in de mails.
// Alles wat van buiten komt (fetch, de lijst met nummers) wordt meegegeven, zodat de tests het kunnen nabootsen.
//
// Benodigd (Cloudflare, door de eigenaar ingesteld): secrets RESEND_API_KEY en TURNSTILE_SECRET, de R2-bucket
// met binding BLADMUZIEK (bestanden bladmuziek/<nummer>.pdf) en de drie limiet-bindingen uit wrangler.jsonc.
// Ontbreekt er één, dan geeft de Worker 503 en doet de feature niets. Een andere hostname dan de toegestane
// (zie TOEGESTANE_HOSTS): 403.
//
// Wat echt beschermt: Turnstile, met controle van de hostname en de actie in het antwoord, en de limieten.
// De Origin-controle is alleen een eenvoudig filter tegen verkeerd gebruik door een browser: elk script kan
// die kop zelf zetten, het is geen verificatie.
import {
  antwoord,
  controleerTurnstile,
  EMAIL,
  hostToegestaan,
  leesJson,
  stuurMail as stuurMailVan,
  teVaak,
  TOEGESTANE_HOSTS,
} from './gedeeld.mjs'

export { hostToegestaan, TOEGESTANE_HOSTS }
import { ADRES_MARIELLE, AFZENDER, mailBezoeker, mailMarielle } from './teksten.mjs'

export const PAD = '/api/bladmuziek'
const MAX_VERZOEK = 4096
// De actie die het Turnstile-widget in het formulier moet meegeven (data-action); Turnstile geeft hem terug
const TURNSTILE_ACTIE = 'bladmuziek'
const MAX_PDF = 15 * 1024 * 1024

export const geconfigureerd = (env) =>
  Boolean(
    env.RESEND_API_KEY &&
    env.TURNSTILE_SECRET &&
    env.BLADMUZIEK &&
    env.LIMIET_IP &&
    env.LIMIET_ADRES &&
    env.LIMIET_ALGEMEEN,
  )

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

const stuurMail = (env, deps, mail) => stuurMailVan(env, deps, mail, AFZENDER)

// Geeft een Response voor elk verzoek aan /api/..., en null voor al het andere.
export async function behandel(request, env, deps) {
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/api/')) return null
  if (url.pathname !== PAD) return antwoord(404, { fout: 'niet_gevonden' })
  if (request.method !== 'POST') return antwoord(405, { fout: 'methode' }, { allow: 'POST' })
  if (!hostToegestaan(env, url.hostname)) return antwoord(403, { fout: 'adres_niet_toegestaan' })
  if (!geconfigureerd(env)) return antwoord(503, { fout: 'uitgeschakeld' })

  const gelezen = await leesJson(request, url, MAX_VERZOEK)
  if (gelezen.antwoord) return gelezen.antwoord
  const invoer = gelezen.invoer

  // Honeypot: een veld dat een mens niet ziet. Is het gevuld, dan doen we alsof het gelukt is en sturen niets.
  if (typeof invoer.website === 'string' && invoer.website !== '')
    return antwoord(200, { ok: true })

  const v = controleer(invoer, deps.lijst)
  if (v.fout)
    return antwoord(v.fout === 'onbekend_nummer' ? 404 : 400, {
      fout: v.fout,
      ...(v.veld ? { veld: v.veld } : {}),
    })

  // Turnstile: het token moet voor onze hostname en voor de actie van dit formulier zijn uitgegeven
  const geweigerd = await controleerTurnstile(env, deps, v.token, url, TURNSTILE_ACTIE)
  if (geweigerd) return geweigerd

  // Limieten per minuut, in deze volgorde en met een vroege stop (een geblokkeerd verzoek telt niet mee voor de
  // volgende limiet): per IP-adres van de bezoeker (alleen voor de beveiliging, als HMAC-sleutel, nooit
  // bewaard of gelogd), per e-mailadres, en voor de hele site.
  const ip = request.headers.get('cf-connecting-ip') ?? 'geen-ip'
  if (
    await teVaak(env, [
      [env.LIMIET_IP, `ip:${ip}`],
      [env.LIMIET_ADRES, `adres:${v.email.toLowerCase()}`],
      [env.LIMIET_ALGEMEEN, null],
    ])
  )
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
