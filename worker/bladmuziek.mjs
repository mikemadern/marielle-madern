// POST /api/bladmuziek: stuurt de bladmuziek van een nummer per e-mail (Resend) naar de bezoeker.
// Geen logging van naam of e-mailadres. Als er een database is (opslag.mjs) staat het bericht daar 30 dagen, daarna
// is het anoniem; zonder database bestaan ze alleen in dit verzoek en in de mails.
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
  teVaak,
  TOEGESTANE_HOSTS,
} from './gedeeld.mjs'

import { ADRES_MARIELLE, AFZENDER, mailBezoeker, mailMarielle } from './teksten.mjs'
import { bewaar, verstuurEnMarkeer } from './opslag.mjs'

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

// Leest de pdf van een nummer uit de privé-bucket; de sleutel volgt uit de naam van het nummer, nooit uit de invoer
// zelf. Geeft { inhoud } (base64) of { fout: 'geen_bestand' | 'te_groot' }. Ook de herhaling (onderhoud.mjs) leest het
// bestand zo opnieuw: de pdf wordt nooit in de database bewaard.
export async function leesPdf(env, nummer) {
  const bestand = await env.BLADMUZIEK.get(`bladmuziek/${nummer}.pdf`)
  if (!bestand) return { fout: 'geen_bestand' }
  if (bestand.size > MAX_PDF) return { fout: 'te_groot' }
  return { inhoud: naarBase64(await bestand.arrayBuffer()) }
}

// De mail met de pdf aan de bezoeker, en de nieuwsbriefmail aan Mariëlle (eerste versie, geen nieuwsbriefsoftware)
export const bladmuziekMail = ({ naam, email, nummer, titel, nieuwsbrief, inhoud }) => ({
  to: [email],
  ...mailBezoeker({ naam, titel, nieuwsbrief }),
  attachments: [{ filename: `bladmuziek-${nummer}.pdf`, content: inhoud }],
})
export const nieuwsbriefMail = ({ naam, email, titel }) => ({
  to: [ADRES_MARIELLE],
  reply_to: email,
  ...mailMarielle({ naam, email, titel, nieuwsbrief: true }),
})

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

  // Het bestand komt uit de privé-bucket
  const pdf = await leesPdf(env, v.nummer)
  if (pdf.fout === 'geen_bestand') return antwoord(404, { fout: 'geen_bestand' })
  if (pdf.fout) return antwoord(500, { fout: 'verzenden_mislukt' })

  const titel = deps.lijst[v.nummer].titel
  const nu = deps.nu?.() ?? new Date()
  // Eerst opslaan (als er een database is): staat het bericht daar, dan gaat er niets verloren als de mail niet lukt
  const id = await bewaar(
    env,
    {
      soort: 'bladmuziek',
      onderwerp: v.nummer,
      naam: v.naam,
      email: v.email,
      extra: { nieuwsbrief: v.nieuwsbrief },
      tweede: v.nieuwsbrief,
    },
    nu,
  )
  const uitslag = await verstuurEnMarkeer(
    env,
    deps,
    {
      id,
      welke: 'hoofd',
      afzender: AFZENDER,
      mail: bladmuziekMail({ ...v, titel, inhoud: pdf.inhoud }),
    },
    nu,
  )
  if (uitslag !== 'ok') {
    // Een tijdelijke fout met het bericht veilig opgeslagen: de bezoeker hoort dat het is aangekomen, de mail volgt
    if (id && (uitslag === 'limiet' || uitslag === 'later'))
      return antwoord(200, { ok: true, later: true, nieuwsbriefVerstuurd: false })
    if (uitslag === 'limiet') return antwoord(503, { fout: 'tijdelijk_niet_beschikbaar' })
    return antwoord(502, { fout: 'verzenden_mislukt' })
  }

  // Nieuwsbrief: een mail aan Mariëlle met de naam en het adres
  let nieuwsbriefVerstuurd = false
  if (v.nieuwsbrief) {
    nieuwsbriefVerstuurd =
      (await verstuurEnMarkeer(
        env,
        deps,
        { id, welke: 'tweede', afzender: AFZENDER, mail: nieuwsbriefMail({ ...v, titel }) },
        nu,
      )) === 'ok'
  }
  return antwoord(200, { ok: true, nieuwsbriefVerstuurd })
}

// De hostcontrole is gedeeld met het contactformulier (gedeeld.mjs); de tests van de bladmuziek importeren haar hier
export { hostToegestaan, TOEGESTANE_HOSTS }
