// POST /api/nieuwsbrief: het losse aanmeldformulier voor de nieuwsbrief. Zet het e-mailadres (en als de bezoeker ze
// invulde, de voornaam en achternaam) op de lijst van Brevo (worker/brevo.mjs). Er is geen bevestigingsmail van
// Brevo (besluit van de eigenaar) en er komt geen mail aan Mariëlle. De bezoeker krijgt in alle gevallen hetzelfde
// antwoord, ook als het adres al bestond.
//
// Zelfde bescherming als de andere eindpunten (alles uit gedeeld.mjs): hostcontrole, Origin en JSON-maximum, honeypot,
// Turnstile met een eigen actie ('nieuwsbrief'), eigen limieten per IP-adres, per adres en voor de hele site.
//
// UIT tot de eigenaar de variabele NIEUWSBRIEF_AAN op 'aan' zet in wrangler.jsonc ("vars"): het formulier op de pagina
// komt pas in een volgende stap, samen met de privacytekst die erbij hoort. Zonder die variabele geeft het eindpunt 503.
// Benodigd verder: de secrets BREVO_API_KEY en TURNSTILE_SECRET, de variabele BREVO_LIJST_ID en de drie limiet-
// bindingen voor de nieuwsbrief. Een andere hostname dan de toegestane: 403.
//
// Opslag: als er een database is (BERICHTEN), staat de aanmelding daar alleen voor een nieuwe poging als Brevo even niet
// werkt (soort 'nieuwsbrief': naam = voornaam, extra = achternaam). Zodra de aanmelding klaar is (gelukt, afgekeurd of
// na 24 uur) worden adres en namen meteen gewist; de rij houdt alleen dag, soort, bron en status.
import {
  antwoord,
  controleerTurnstile,
  EMAIL,
  hostToegestaan,
  leesJson,
  teVaak,
} from './gedeeld.mjs'
import { brevoAan, meldAan } from './brevo.mjs'
import { bewaar, dagAmsterdam, markeer, wis } from './opslag.mjs'
import { veiligeNaam } from './teksten.mjs'

export const PAD = '/api/nieuwsbrief'
// Er is alleen een adres, een paar namen en het token
export const MAX_VERZOEK = 2048
// De actie die het Turnstile-widget in het formulier moet meegeven (data-action); Turnstile geeft hem terug
const TURNSTILE_ACTIE = 'nieuwsbrief'
export const BRON = 'formulier'

export const geconfigureerd = (env) =>
  Boolean(
    env.NIEUWSBRIEF_AAN === 'aan' &&
    brevoAan(env) &&
    env.TURNSTILE_SECRET &&
    env.LIMIET_NIEUWSBRIEF_IP &&
    env.LIMIET_NIEUWSBRIEF_ADRES &&
    env.LIMIET_NIEUWSBRIEF_ALGEMEEN,
  )

// Een naam: alleen tekst die door veiligeNaam komt (maximaal 60 tekens); al het andere (geen tekst, een lijst, te lang,
// een link, cijfers) geeft undefined en wordt gewoon weggelaten.
const naam = (waarde) =>
  typeof waarde === 'string' ? (veiligeNaam(waarde, 60) ?? undefined) : undefined

// Controleert de velden. Alleen het adres is verplicht. De namen zijn optioneel: een naam die geen tekst is, te lang is
// of niet 'gewoon' is (veiligeNaam) wordt weggelaten en nooit afgewezen.
export function controleer(invoer) {
  const email = typeof invoer.email === 'string' ? invoer.email.trim() : ''
  if (!email || email.length > 254 || !EMAIL.test(email)) return { fout: 'ongeldig', veld: 'email' }
  const token = typeof invoer.token === 'string' ? invoer.token : ''
  if (!token || token.length > 2048) return { fout: 'controle_mislukt' }
  return {
    email,
    token,
    voornaam: naam(invoer.voornaam),
    achternaam: naam(invoer.achternaam),
  }
}

// Geeft een Response voor een verzoek aan /api/nieuwsbrief (de router stuurt alleen dat pad hierheen).
export async function behandel(request, env, deps) {
  const url = new URL(request.url)
  if (request.method !== 'POST') return antwoord(405, { fout: 'methode' }, { allow: 'POST' })
  if (!hostToegestaan(env, url.hostname)) return antwoord(403, { fout: 'adres_niet_toegestaan' })
  if (!geconfigureerd(env)) return antwoord(503, { fout: 'uitgeschakeld' })

  const gelezen = await leesJson(request, url, MAX_VERZOEK)
  if (gelezen.antwoord) return gelezen.antwoord
  const invoer = gelezen.invoer

  // Honeypot: een veld dat een mens niet ziet. Is het gevuld, dan doen we alsof het gelukt is en doen niets.
  if (typeof invoer.website === 'string' && invoer.website !== '')
    return antwoord(200, { ok: true })

  const v = controleer(invoer)
  if (v.fout) return antwoord(400, { fout: v.fout, ...(v.veld ? { veld: v.veld } : {}) })

  // Turnstile: het token moet voor onze hostname en voor de actie van dit formulier zijn uitgegeven
  const geweigerd = await controleerTurnstile(env, deps, v.token, url, TURNSTILE_ACTIE)
  if (geweigerd) return geweigerd

  // Eigen limieten per minuut (los van de andere formulieren), met een vroege stop
  const ip = request.headers.get('cf-connecting-ip') ?? 'geen-ip'
  if (
    await teVaak(env, [
      [env.LIMIET_NIEUWSBRIEF_IP, `nieuwsbrief-ip:${ip}`],
      [env.LIMIET_NIEUWSBRIEF_ADRES, `nieuwsbrief-adres:${v.email.toLowerCase()}`],
      [env.LIMIET_NIEUWSBRIEF_ALGEMEEN, null],
    ])
  )
    return antwoord(429, { fout: 'te_vaak' }, { 'retry-after': '60' })

  const nu = deps.nu?.() ?? new Date()
  const dag = dagAmsterdam(nu)
  // Eerst opslaan (als er een database is), alleen voor een nieuwe poging als Brevo even niet werkt
  const id = await bewaar(
    env,
    {
      soort: 'nieuwsbrief',
      onderwerp: BRON,
      naam: v.voornaam ?? null,
      email: v.email,
      extra: v.achternaam ? { achternaam: v.achternaam } : null,
    },
    nu,
  )
  const uitslag = await meldAan(env, deps, {
    email: v.email,
    bron: BRON,
    dag,
    voornaam: v.voornaam,
    achternaam: v.achternaam,
  })
  // Klaar (gelukt of voorgoed afgekeurd): de status bijwerken en adres en namen meteen wissen
  if (uitslag === 'ok' || uitslag === 'permanent') {
    await markeer(env, id, 'hoofd', uitslag, nu)
    await wis(env, id)
  } else if (id) {
    // Tijdelijk mislukt (Brevo of de sleutel): de rij blijft op `wacht` voor de Cron, de bezoeker hoort dat het is
    // aangekomen. Zonder opgeslagen rij kan niets later worden gedaan: dan krijgt de bezoeker de fout.
    await markeer(env, id, 'hoofd', uitslag, nu)
  }
  if (uitslag === 'ok') return antwoord(200, { ok: true })
  if (uitslag === 'permanent') return antwoord(400, { fout: 'ongeldig', veld: 'email' })
  if (id) return antwoord(200, { ok: true, later: true })
  return antwoord(503, { fout: 'tijdelijk_niet_beschikbaar' })
}
