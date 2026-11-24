// Anonieme statistiek: hoe vaak is de bladmuziek van elk nummer per dag aangevraagd. Alleen dag en nummer, in een
// Cloudflare D1-database (binding STATISTIEK). Geen naam, geen e-mailadres, geen IP-adres, geen hash daarvan en geen
// tijdstip. Tabel (de eigenaar maakt hem aan in de D1-console; de stappen staan in de PR-tekst, de README volgt met de binding):
//   CREATE TABLE aanvragen (dag TEXT NOT NULL, nummer TEXT NOT NULL, aantal INTEGER NOT NULL DEFAULT 0,
//     PRIMARY KEY (dag, nummer)) WITHOUT ROWID;
// Zonder binding doet de Worker niets extra's (geen fout): zolang de database er niet is, werkt alles zoals eerst.

// De dag in Europe/Amsterdam (JJJJ-MM-DD), niet in UTC: de eigenaar leest 'per dag' naar zijn eigen klok, en een
// aanvraag om 23:30 hoort niet bij de volgende dag.
const DAGEN = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Amsterdam',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
export const dagAmsterdam = (nu = new Date()) => DAGEN.format(nu)

const TEL =
  'INSERT INTO aanvragen (dag, nummer, aantal) VALUES (?1, ?2, 1) ON CONFLICT (dag, nummer) DO UPDATE SET aantal = aantal + 1'

// Telt één aanvraag. Gooit nooit: een fout in de telling mag het versturen niet laten mislukken en wordt niet
// gelogd (er zijn geen gegevens die we in een log willen hebben).
export async function telAanvraag(env, nummer, nu = new Date()) {
  try {
    if (!env.STATISTIEK) return false
    await env.STATISTIEK.prepare(TEL).bind(dagAmsterdam(nu), nummer).run()
    return true
  } catch {
    return false
  }
}
