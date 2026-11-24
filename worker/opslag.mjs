// Opslag van de ingevulde formulieren in Cloudflare D1 (binding BERICHTEN), als back-up voor als Resend even niet
// bereikbaar is: een bericht staat dan in de database en wordt later opnieuw verstuurd (die herhaling komt in een
// volgende stap). Na 30 dagen wordt het geanonimiseerd: naam, e-mailadres, bericht en extra gegevens verdwijnen, dag,
// soort, onderwerp (of nummer) en de status blijven (dat zijn de statistieken).
//
// Zonder binding doet alles in dit bestand niets en gaat de Worker te werk alsof er geen opslag is. Een fout in de
// database mag het versturen nooit laten mislukken en wordt niet gelogd (er zijn geen gegevens die we in een log
// willen hebben). Alle SQL gebruikt gebonden parameters.
import { stuurMail } from './gedeeld.mjs'

// De tabel; de eigenaar voert deze opdracht één keer uit in de D1-console (zie de README)
export const SCHEMA = `CREATE TABLE berichten (
  id TEXT PRIMARY KEY,
  soort TEXT NOT NULL,
  aangemaakt TEXT NOT NULL,
  dag TEXT NOT NULL,
  onderwerp TEXT NOT NULL,
  naam TEXT,
  email TEXT,
  bericht TEXT,
  extra TEXT,
  status_hoofd TEXT NOT NULL DEFAULT 'wacht',
  status_tweede TEXT NOT NULL DEFAULT 'nvt',
  pogingen INTEGER,
  laatste_poging TEXT,
  geanonimiseerd_op TEXT
);
CREATE INDEX berichten_dag ON berichten (dag);
CREATE INDEX berichten_open ON berichten (status_hoofd, status_tweede);`

// De dag in Europe/Amsterdam (JJJJ-MM-DD), niet in UTC: de eigenaar leest 'per dag' naar zijn eigen klok, en een
// aanvraag om 23:30 hoort niet bij de volgende dag.
const DAGEN = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Amsterdam',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
export const dagAmsterdam = (nu = new Date()) => DAGEN.format(nu)

// Slaat een bericht op (status `wacht`). Geeft het id, of null als er geen binding is of het opslaan mislukt:
// dan gaat het versturen gewoon door.
export async function bewaar(env, b, nu = new Date()) {
  try {
    if (!env.BERICHTEN) return null
    const id = crypto.randomUUID()
    await env.BERICHTEN.prepare(
      `INSERT INTO berichten (id, soort, aangemaakt, dag, onderwerp, naam, email, bericht, extra, status_hoofd, status_tweede)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'wacht', ?10)`,
    )
      .bind(
        id,
        b.soort,
        nu.toISOString(),
        dagAmsterdam(nu),
        b.onderwerp,
        b.naam,
        b.email,
        b.bericht ?? null,
        b.extra ? JSON.stringify(b.extra) : null,
        b.tweede ? 'wacht' : 'nvt',
      )
      .run()
    return id
  } catch {
    return null
  }
}

const KOLOMMEN = { hoofd: 'status_hoofd', tweede: 'status_tweede' }
const STATUS = { ok: 'verzonden', permanent: 'mislukt' }

// Verstuurt een mail en werkt de status in de database bij: 'verzonden' bij gelukt, 'mislukt' bij een permanente fout,
// en `wacht` blijft staan bij een tijdelijke fout (limiet, 5xx, geen verbinding): dan volgt een nieuwe poging. Elke
// aanroep krijgt een Idempotency-Key (`<id>-hoofd` of `<id>-tweede`), zodat een herhaling nooit een dubbele mail geeft.
// Zonder id (niet opgeslagen) is het gewoon `stuurMail`. Geeft de uitkomst van Resend.
export async function verstuurEnMarkeer(env, deps, { id, welke, mail, afzender }, nu = new Date()) {
  const uitslag = await stuurMail(env, deps, mail, afzender, id ? `${id}-${welke}` : undefined)
  if (id) {
    try {
      await env.BERICHTEN.prepare(
        `UPDATE berichten SET ${KOLOMMEN[welke]} = CASE WHEN ?1 IS NULL THEN ${KOLOMMEN[welke]} ELSE ?1 END,
         pogingen = COALESCE(pogingen, 0) + 1, laatste_poging = ?2 WHERE id = ?3`,
      )
        .bind(STATUS[uitslag] ?? null, nu.toISOString(), id)
        .run()
    } catch {
      // een fout in de database verandert niets aan het versturen
    }
  }
  return uitslag
}
