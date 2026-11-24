// De nieuwsbrief: een e-mailadres op de lijst van Brevo zetten (POST https://api.brevo.com/v3/contacts). Alleen het
// adres en het lijstnummer gaan mee, en twee eigen attributen als bewijs van de toestemming (BRON en AANGEMELD_OP;
// de eigenaar maakt ze in Brevo aan). De naam gaat niet naar Brevo.
//
// Benodigd: de secret BREVO_API_KEY (alleen in het Cloudflare-dashboard) en de gewone variabele BREVO_LIJST_ID in
// wrangler.jsonc ("vars"). De sleutel staat nergens in code, tests of antwoorden, en er wordt niets gelogd.
//
// Een adres dat al bestaat geeft bij Brevo een 400 'duplicate_parameter': dan zetten we het adres alleen op de lijst
// (PUT met alleen listIds), zodat bron en datum van de eerste aanmelding blijven staan. De bezoeker merkt het verschil
// nooit: wie hier wordt aangeroepen krijgt in alle gevallen hetzelfde antwoord. `emailBlacklisted` wordt nooit
// aangeraakt: wie zich heeft uitgeschreven, wordt door een formulier niet stilletjes opnieuw ingeschreven.
import { dagAmsterdam, markeer } from './opslag.mjs'

export const BREVO = 'https://api.brevo.com/v3/contacts'
// Brevo moet binnen deze tijd antwoorden, anders wacht de bezoeker te lang (de Cron probeert het later opnieuw)
const WACHT_MS = 5000

// Het lijstnummer uit de variabele BREVO_LIJST_ID: een positief geheel getal, anders null (dan is de nieuwsbrief uit)
export function lijstId(env) {
  const tekst = String(env.BREVO_LIJST_ID ?? '').trim()
  if (!/^[1-9]\d{0,9}$/.test(tekst)) return null
  return Number(tekst)
}

export const brevoAan = (env) => Boolean(env.BREVO_API_KEY && lijstId(env) !== null)

// Eén aanroep naar Brevo. Geeft { status, code } (code uit het antwoord bij een fout), of null zonder verbinding.
async function aanroep(env, deps, methode, adres, body) {
  try {
    const res = await deps.fetch(adres, {
      method: methode,
      headers: {
        'api-key': env.BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(WACHT_MS),
    })
    const code = res.ok ? '' : String((await res.json().catch(() => null))?.code ?? '')
    return { status: res.status, code }
  } catch {
    return null
  }
}

// Zet het adres op de lijst. Uitkomst, zoals bij een mail: 'ok'; 'later' (geen verbinding, time-out, 429, 5xx, of
// 401 en 403: een sleutel of instelling die de eigenaar kan herstellen, een nieuwe poging kan dan slagen);
// 'permanent' (een andere 4xx, bijvoorbeeld een ongeldig adres: opnieuw proberen helpt niet).
// `bron` is 'formulier' of 'bladmuziek:<nummer>'; `dag` is de dag van de aanmelding (JJJJ-MM-DD, Europe/Amsterdam).
export async function meldAan(env, deps, { email, bron, dag = dagAmsterdam() }) {
  const lijst = lijstId(env)
  if (!env.BREVO_API_KEY || lijst === null) return 'later'
  const nieuw = { email, listIds: [lijst] }
  let r = await aanroep(env, deps, 'POST', BREVO, {
    ...nieuw,
    attributes: { BRON: bron, AANGEMELD_OP: dag },
  })
  // Een attribuut dat in Brevo nog niet bestaat geeft een 400: dan één keer opnieuw zonder attributen, zodat een
  // ontbrekend attribuut nooit een aanmelding tegenhoudt
  if (r?.status === 400 && r.code === 'invalid_parameter')
    r = await aanroep(env, deps, 'POST', BREVO, nieuw)
  // Bestaat het adres al: alleen de lijst bijwerken (bron en datum van de eerste keer blijven staan)
  if (r?.status === 400 && r.code === 'duplicate_parameter')
    r = await aanroep(env, deps, 'PUT', `${BREVO}/${encodeURIComponent(email)}`, {
      listIds: [lijst],
    })
  if (!r) return 'later'
  if (r.status >= 200 && r.status < 300) return 'ok'
  if ([401, 403, 429].includes(r.status) || r.status >= 500) return 'later'
  return 'permanent'
}

// Meldt aan en werkt de status van het bericht in de database bij (zoals verstuurEnMarkeer bij een mail): 'verzonden'
// bij gelukt, 'mislukt' bij een permanente fout, en `wacht` blijft staan bij een tijdelijke fout: dan volgt een nieuwe
// poging. Zonder id (niet opgeslagen) is het gewoon `meldAan`.
export async function meldAanEnMarkeer(env, deps, { id, email, bron, dag }, nu = new Date()) {
  const uitslag = await meldAan(env, deps, { email, bron, dag: dag ?? dagAmsterdam(nu) })
  await markeer(env, id, 'tweede', uitslag, nu)
  return uitslag
}
