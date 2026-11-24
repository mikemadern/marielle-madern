// Het onderhoud van de opgeslagen berichten (Cron Trigger, elke 5 minuten): berichten waarvan een mail niet is gelukt
// opnieuw proberen, en berichten van 30 dagen of ouder anonimiseren. Eén taak met drie stappen; elke stap en elke rij
// heeft zijn eigen try/catch, zodat een fout in één bericht de rest niet tegenhoudt. Niets wordt gelogd en er komen
// geen gegevens in een foutmelding: een fout laat de rij gewoon op `wacht` staan voor de volgende keer.
// Zonder binding BERICHTEN doet dit niets.
import { bladmuziekMail, leesPdf, nieuwsbriefMail } from './bladmuziek.mjs'
import { dagAmsterdam, verstuurEnMarkeer } from './opslag.mjs'
import {
  ADRES_MARIELLE,
  AFZENDER,
  mailContactBevestiging,
  mailContactMarielle,
} from './teksten.mjs'

// Hoe lang een mail opnieuw wordt geprobeerd (ook de bewaartijd van de Idempotency-Key bij Resend), en hoe lang een
// bericht leesbaar blijft
export const HERHAAL_UREN = 24
export const BEWAAR_DAGEN = 30
const PER_RUN = 20
const UUR = 3_600_000
const DAG = 24 * UUR

const aantal = (uitslag) => uitslag?.meta?.changes ?? 0

// Stap 1: wat na 24 uur nog op `wacht` staat wordt `mislukt`
async function laatVerlopen(env, nu) {
  const grens = new Date(nu.getTime() - HERHAAL_UREN * UUR).toISOString()
  const uitslag = await env.BERICHTEN.prepare(
    `UPDATE berichten SET
       status_hoofd = CASE WHEN status_hoofd = 'wacht' THEN 'mislukt' ELSE status_hoofd END,
       status_tweede = CASE WHEN status_tweede = 'wacht' THEN 'mislukt' ELSE status_tweede END
     WHERE geanonimiseerd_op IS NULL AND aangemaakt < ?1 AND (status_hoofd = 'wacht' OR status_tweede = 'wacht')`,
  )
    .bind(grens)
    .run()
  return aantal(uitslag)
}

async function markeerMislukt(env, id, kolommen) {
  // kolommen komt uit onze eigen code, nooit van een bezoeker
  const zet = kolommen
    .map((k) => `${k} = CASE WHEN ${k} = 'wacht' THEN 'mislukt' ELSE ${k} END`)
    .join(', ')
  await env.BERICHTEN.prepare(`UPDATE berichten SET ${zet} WHERE id = ?1`).bind(id).run()
}

// Eén bericht opnieuw proberen: eerst de hoofdmail (als die nog op `wacht` staat), dan de tweede mail
async function herhaalRij(env, deps, r, nu) {
  const extra = r.extra ? JSON.parse(r.extra) : {}
  const titel = deps.lijst?.[r.onderwerp]?.titel
  if (r.status_hoofd === 'wacht') {
    let mail
    if (r.soort === 'contact') {
      mail = {
        to: [ADRES_MARIELLE],
        reply_to: r.email,
        ...mailContactMarielle({
          naam: r.naam,
          email: r.email,
          onderwerp: r.onderwerp,
          bericht: r.bericht,
          boeking: extra,
        }),
      }
    } else {
      // De pdf wordt opnieuw uit de bucket gelezen; is hij weg (of het nummer niet meer in de lijst), dan lukt het nooit meer
      const pdf = titel ? await leesPdf(env, r.onderwerp) : { fout: 'geen_bestand' }
      if (pdf.fout) return markeerMislukt(env, r.id, ['status_hoofd', 'status_tweede'])
      mail = bladmuziekMail({
        naam: r.naam,
        email: r.email,
        nummer: r.onderwerp,
        titel,
        nieuwsbrief: extra.nieuwsbrief === true,
        inhoud: pdf.inhoud,
      })
    }
    const uitslag = await verstuurEnMarkeer(
      env,
      deps,
      { id: r.id, welke: 'hoofd', afzender: AFZENDER, mail },
      nu,
    )
    // Mislukt de hoofdmail voorgoed, dan heeft de tweede mail geen zin meer
    if (uitslag === 'permanent') return markeerMislukt(env, r.id, ['status_tweede'])
    if (uitslag !== 'ok') return
  }
  if (r.status_tweede === 'wacht') {
    const mail =
      r.soort === 'contact'
        ? { to: [r.email], ...mailContactBevestiging() }
        : extra.nieuwsbrief === true && titel
          ? nieuwsbriefMail({ naam: r.naam, email: r.email, titel })
          : null
    if (!mail) return markeerMislukt(env, r.id, ['status_tweede'])
    await verstuurEnMarkeer(env, deps, { id: r.id, welke: 'tweede', afzender: AFZENDER, mail }, nu)
  }
}

// Stap 2: opnieuw proberen, hooguit PER_RUN berichten per keer, de oudste eerst
async function herhaal(env, deps, nu) {
  const grens = new Date(nu.getTime() - HERHAAL_UREN * UUR).toISOString()
  const { results } = await env.BERICHTEN.prepare(
    `SELECT id, soort, onderwerp, naam, email, bericht, extra, status_hoofd, status_tweede FROM berichten
     WHERE geanonimiseerd_op IS NULL AND aangemaakt >= ?1
       AND (status_hoofd = 'wacht' OR (status_hoofd = 'verzonden' AND status_tweede = 'wacht'))
     ORDER BY aangemaakt LIMIT ${PER_RUN}`,
  )
    .bind(grens)
    .all()
  let gedaan = 0
  for (const r of results ?? []) {
    try {
      await herhaalRij(env, deps, r, nu)
      gedaan++
    } catch {
      // een fout bij dit bericht: het blijft op `wacht` staan voor de volgende keer
    }
  }
  return gedaan
}

// Stap 3: berichten van 30 dagen of ouder anonimiseren, als geen mail meer op `wacht` staat. Naam, e-mailadres,
// bericht en extra gegevens verdwijnen; dag, soort, onderwerp (of nummer) en de statussen blijven (de statistieken).
async function anonimiseer(env, nu) {
  const grens = dagAmsterdam(new Date(nu.getTime() - BEWAAR_DAGEN * DAG))
  const uitslag = await env.BERICHTEN.prepare(
    `UPDATE berichten SET naam = NULL, email = NULL, bericht = NULL, extra = NULL, aangemaakt = dag,
       pogingen = NULL, laatste_poging = NULL, geanonimiseerd_op = ?1
     WHERE geanonimiseerd_op IS NULL AND dag < ?2 AND status_hoofd <> 'wacht' AND status_tweede <> 'wacht'`,
  )
    .bind(dagAmsterdam(nu), grens)
    .run()
  return aantal(uitslag)
}

// Het hele onderhoud. Geeft alleen aantallen terug (nooit gegevens).
export async function onderhoud(env, deps, nu = new Date()) {
  const uitkomst = { verlopen: 0, herhaald: 0, geanonimiseerd: 0 }
  if (!env.BERICHTEN) return uitkomst
  for (const [naam, stap] of [
    ['verlopen', () => laatVerlopen(env, nu)],
    ['herhaald', () => herhaal(env, deps, nu)],
    ['geanonimiseerd', () => anonimiseer(env, nu)],
  ]) {
    try {
      uitkomst[naam] = await stap()
    } catch {
      // een fout in één stap houdt de andere niet tegen
    }
  }
  return uitkomst
}
