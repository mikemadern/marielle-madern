// Het onderhoud van de opgeslagen berichten (Cron Trigger, elke 5 minuten): berichten waarvan een mail of een aanmelding
// niet is gelukt opnieuw proberen, en berichten van 30 dagen of ouder anonimiseren. Eén taak met vier stappen; elke stap en elke rij
// heeft zijn eigen try/catch, zodat een fout in één bericht de rest niet tegenhoudt. Niets wordt gelogd en er komen
// geen gegevens in een foutmelding: een fout laat de rij gewoon op `wacht` staan voor de volgende keer.
// Zonder binding BERICHTEN doet dit niets.
import { bladmuziekMail, leesPdf } from './bladmuziek.mjs'
import { meldAanEnMarkeer, VOLLEDIGE_NAAM_MAX } from './brevo.mjs'
import { dagAmsterdam, verstuurEnMarkeer, wis } from './opslag.mjs'
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
  // Een aanmelding voor de nieuwsbrief via het losse formulier: alleen de aanmelding bij Brevo, met de voornaam (naam) en de
  // achternaam (extra). Is die klaar (gelukt of afgekeurd), dan gaan het adres en de namen meteen uit de rij.
  if (r.soort === 'nieuwsbrief') {
    if (!r.email) return markeerMislukt(env, r.id, ['status_hoofd'])
    const uitslag = await meldAanEnMarkeer(
      env,
      deps,
      {
        id: r.id,
        welke: 'hoofd',
        email: r.email,
        bron: r.onderwerp,
        dag: r.dag,
        voornaam: r.naam ?? undefined,
        achternaam: extra.achternaam,
      },
      nu,
    )
    if (uitslag === 'ok' || uitslag === 'permanent') await wis(env, r.id)
    return
  }
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
    // Bij een contactbericht is de tweede stap de bevestiging aan de bezoeker; bij de bladmuziek de aanmelding voor de
    // nieuwsbrief bij Brevo (alleen het adres; de bron en de dag zijn die van de eerste aanvraag)
    if (r.soort === 'contact') {
      await verstuurEnMarkeer(
        env,
        deps,
        {
          id: r.id,
          welke: 'tweede',
          afzender: AFZENDER,
          mail: { to: [r.email], ...mailContactBevestiging() },
        },
        nu,
      )
    } else if (extra.nieuwsbrief === true && r.email) {
      await meldAanEnMarkeer(
        env,
        deps,
        {
          id: r.id,
          email: r.email,
          bron: `bladmuziek:${r.onderwerp}`,
          dag: r.dag,
          voornaam: r.naam ?? undefined,
          voornaamMax: VOLLEDIGE_NAAM_MAX,
        },
        nu,
      )
    } else return markeerMislukt(env, r.id, ['status_tweede'])
  }
}

// Stap 2: opnieuw proberen, hooguit PER_RUN berichten per keer, de oudste eerst
async function herhaal(env, deps, nu) {
  const grens = new Date(nu.getTime() - HERHAAL_UREN * UUR).toISOString()
  const { results } = await env.BERICHTEN.prepare(
    `SELECT id, soort, dag, onderwerp, naam, email, bericht, extra, status_hoofd, status_tweede FROM berichten
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

// Stap 3: de aanmeldingen voor de nieuwsbrief via het losse formulier die klaar zijn (gelukt, afgekeurd of na 24 uur
// verlopen) hebben geen adres of naam meer nodig: die gaan meteen weg (vangnet voor het wissen bij het aanmelden zelf).
async function wisAfgehandeld(env) {
  const uitslag = await env.BERICHTEN.prepare(
    `UPDATE berichten SET naam = NULL, email = NULL, bericht = NULL, extra = NULL
     WHERE soort = 'nieuwsbrief' AND status_hoofd <> 'wacht'
       AND (naam IS NOT NULL OR email IS NOT NULL OR bericht IS NOT NULL OR extra IS NOT NULL)`,
  )
    .bind()
    .run()
  return aantal(uitslag)
}

// Stap 4: berichten van 30 dagen of ouder anonimiseren, als geen mail meer op `wacht` staat. Naam, e-mailadres,
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
  const uitkomst = { verlopen: 0, herhaald: 0, gewist: 0, geanonimiseerd: 0 }
  if (!env.BERICHTEN) return uitkomst
  for (const [naam, stap] of [
    ['verlopen', () => laatVerlopen(env, nu)],
    ['herhaald', () => herhaal(env, deps, nu)],
    ['gewist', () => wisAfgehandeld(env)],
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
