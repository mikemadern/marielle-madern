// POST /api/contact: het contactformulier (algemene vragen en boekingen). Stuurt een mail aan Mariëlle (met het
// adres van de bezoeker als reply_to) en een bevestiging met alleen vaste tekst aan de bezoeker (Resend).
// Zelfde aanpak als de bladmuziek: Turnstile (actie 'contact'), eigen limieten, niets gelogd, en (als er een database is) 30 dagen bewaard als back-up (opslag.mjs).
//
// UIT tot de eigenaar de variabele CONTACT_AAN op 'aan' zet in wrangler.jsonc ("vars"): zonder die variabele geeft het
// eindpunt 503. Benodigd: de secrets RESEND_API_KEY en TURNSTILE_SECRET (dezelfde als bij de bladmuziek) en de drie
// limiet-bindingen voor contact uit wrangler.jsonc. Een andere hostname dan de toegestane: 403.
import {
  antwoord,
  controleerTurnstile,
  EMAIL,
  hostToegestaan,
  leesJson,
  teVaak,
} from './gedeeld.mjs'
import {
  ADRES_MARIELLE,
  AFZENDER,
  BOEKINGSVELDEN,
  mailContactBevestiging,
  mailContactMarielle,
  ONDERWERPEN,
} from './teksten.mjs'
import { bewaar, verstuurEnMarkeer } from './opslag.mjs'

export const PAD = '/api/contact'
// 5.000 tekens kunnen tot 20 KB UTF-8 zijn, plus de overige velden en het token
export const MAX_VERZOEK = 24 * 1024
export const MAX_BERICHT = 5000
// De actie die het Turnstile-widget in het formulier moet meegeven (data-action); Turnstile geeft hem terug
const TURNSTILE_ACTIE = 'contact'

export const geconfigureerd = (env) =>
  Boolean(
    env.CONTACT_AAN === 'aan' &&
    env.RESEND_API_KEY &&
    env.TURNSTILE_SECRET &&
    env.LIMIET_CONTACT_IP &&
    env.LIMIET_CONTACT_ADRES &&
    env.LIMIET_CONTACT_ALGEMEEN,
  )

// Een regel zonder stuurtekens en regeleinden, met een maximum aan tekens (niet bytes)
const enkeleRegel = (tekst) => tekst.replace(/\p{C}/gu, ' ').replace(/\s+/g, ' ').trim()
const aantalTekens = (tekst) => [...tekst].length

// Controleert de velden. Geeft { fout, veld } bij een fout, anders de schone waarden. De velden voor een boeking
// zijn allemaal optioneel (gewone tekstvelden) en tellen alleen mee als het onderwerp 'boeking' is.
export function controleer(invoer) {
  const naam = typeof invoer.naam === 'string' ? enkeleRegel(invoer.naam) : ''
  if (!naam || aantalTekens(naam) > 100) return { fout: 'ongeldig', veld: 'naam' }
  const email = typeof invoer.email === 'string' ? invoer.email.trim() : ''
  if (!email || email.length > 254 || !EMAIL.test(email)) return { fout: 'ongeldig', veld: 'email' }
  const onderwerp = typeof invoer.onderwerp === 'string' ? invoer.onderwerp : ''
  if (!Object.hasOwn(ONDERWERPEN, onderwerp)) return { fout: 'ongeldig', veld: 'onderwerp' }
  // Regeleinden mogen in het bericht blijven; andere stuurtekens niet
  const bericht =
    typeof invoer.bericht === 'string'
      ? invoer.bericht
          .replace(/\r\n?/g, '\n')
          .replace(/[^\P{C}\n\t]/gu, ' ')
          .trim()
      : ''
  if (!bericht || aantalTekens(bericht) > MAX_BERICHT) return { fout: 'ongeldig', veld: 'bericht' }
  const token = typeof invoer.token === 'string' ? invoer.token : ''
  if (!token || token.length > 2048) return { fout: 'controle_mislukt' }

  const boeking = {}
  if (onderwerp === 'boeking') {
    for (const veld of Object.keys(BOEKINGSVELDEN)) {
      const waarde = invoer[veld]
      if (waarde === undefined || waarde === null || waarde === '') continue
      const tekst = typeof waarde === 'number' ? String(waarde) : waarde
      if (typeof tekst !== 'string') return { fout: 'ongeldig', veld }
      const schoon = enkeleRegel(tekst)
      if (!schoon) continue
      // Gewone tekstvelden ('een zondag in maart', 'ongeveer 200', 'nog niet bekend' zijn goede antwoorden)
      const max = veld === 'speeltijden' ? 200 : 100
      if (aantalTekens(schoon) > max) return { fout: 'ongeldig', veld }
      boeking[veld] = schoon
    }
  }
  return { naam, email, onderwerp, bericht, token, boeking }
}

// Geeft een Response voor een verzoek aan /api/contact (de router stuurt alleen dat pad hierheen).
export async function behandel(request, env, deps) {
  const url = new URL(request.url)
  if (request.method !== 'POST') return antwoord(405, { fout: 'methode' }, { allow: 'POST' })
  if (!hostToegestaan(env, url.hostname)) return antwoord(403, { fout: 'adres_niet_toegestaan' })
  if (!geconfigureerd(env)) return antwoord(503, { fout: 'uitgeschakeld' })

  const gelezen = await leesJson(request, url, MAX_VERZOEK)
  if (gelezen.antwoord) return gelezen.antwoord
  const invoer = gelezen.invoer

  // Honeypot: een veld dat een mens niet ziet. Is het gevuld, dan doen we alsof het gelukt is en sturen niets.
  if (typeof invoer.website === 'string' && invoer.website !== '')
    return antwoord(200, { ok: true })

  const v = controleer(invoer)
  if (v.fout) return antwoord(400, { fout: v.fout, ...(v.veld ? { veld: v.veld } : {}) })

  // Turnstile: het token moet voor onze hostname en voor de actie van dit formulier zijn uitgegeven (een token van
  // het formulier voor de bladmuziek werkt hier dus niet)
  const geweigerd = await controleerTurnstile(env, deps, v.token, url, TURNSTILE_ACTIE)
  if (geweigerd) return geweigerd

  // Eigen limieten per minuut voor dit eindpunt (los van de bladmuziek), met een vroege stop: per IP-adres (alleen
  // voor de beveiliging, als HMAC-sleutel, nooit bewaard of gelogd), per e-mailadres, en voor de hele site.
  const ip = request.headers.get('cf-connecting-ip') ?? 'geen-ip'
  if (
    await teVaak(env, [
      [env.LIMIET_CONTACT_IP, `contact-ip:${ip}`],
      [env.LIMIET_CONTACT_ADRES, `contact-adres:${v.email.toLowerCase()}`],
      [env.LIMIET_CONTACT_ALGEMEEN, null],
    ])
  )
    return antwoord(429, { fout: 'te_vaak' }, { 'retry-after': '60' })

  // Eerst opslaan (als er een database is): staat het bericht daar, dan gaat er niets verloren als de mail niet lukt
  const nu = deps.nu?.() ?? new Date()
  const id = await bewaar(
    env,
    {
      soort: 'contact',
      onderwerp: v.onderwerp,
      naam: v.naam,
      email: v.email,
      bericht: v.bericht,
      extra: Object.keys(v.boeking).length ? v.boeking : null,
      tweede: true,
    },
    nu,
  )

  // Dan de mail aan Mariëlle: dat is de belangrijke.
  const aanMarielle = await verstuurEnMarkeer(
    env,
    deps,
    {
      id,
      welke: 'hoofd',
      afzender: AFZENDER,
      mail: { to: [ADRES_MARIELLE], reply_to: v.email, ...mailContactMarielle(v) },
    },
    nu,
  )
  if (aanMarielle !== 'ok') {
    // Een tijdelijke fout met het bericht veilig opgeslagen: de bezoeker hoort dat het is aangekomen, de mail volgt
    if (id && (aanMarielle === 'limiet' || aanMarielle === 'later'))
      return antwoord(200, { ok: true, later: true, bevestigingVerstuurd: false })
    if (aanMarielle === 'limiet') return antwoord(503, { fout: 'tijdelijk_niet_beschikbaar' })
    return antwoord(502, { fout: 'verzenden_mislukt' })
  }

  // Dan de bevestiging, als bijzaak: mislukt die, dan is het bericht toch aangekomen
  const bevestigingVerstuurd =
    (await verstuurEnMarkeer(
      env,
      deps,
      {
        id,
        welke: 'tweede',
        afzender: AFZENDER,
        mail: { to: [v.email], ...mailContactBevestiging() },
      },
      nu,
    )) === 'ok'
  return antwoord(200, { ok: true, bevestigingVerstuurd })
}
