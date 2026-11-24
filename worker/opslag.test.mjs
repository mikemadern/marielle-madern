// Tests van de opslag in D1 (worker/opslag.mjs) en het gebruik ervan door beide eindpunten. De database is echte SQLite
// (node:sqlite, zoals D1) met het schema uit opslag.mjs; Resend, Turnstile en de limieten zijn nagebootst. Alle namen
// en adressen zijn verzonnen.
// Draaien: pnpm test:worker
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, test } from 'node:test'
import { behandel } from './api.mjs'
import { dagAmsterdam, SCHEMA } from './opslag.mjs'

const HOSTNAME = 'mariellemadern.nl'
const LIJST = { 'hart-van-glas': { titel: 'Hart van glas' } }
const PDF = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10])
const CONTACT = {
  naam: 'Proefpersoon Verzonnen',
  email: 'test@example.org',
  onderwerp: 'vraag',
  bericht: 'Een verzonnen vraag over een optreden.',
  token: 'proef',
}
const BLADMUZIEK = {
  naam: 'Proefpersoon Verzonnen',
  email: 'test@example.org',
  nummer: 'hart-van-glas',
  token: 'proef',
  nieuwsbrief: false,
}

let gesprekken
let logregels
let origineel
let sqls

// Een D1-achtige binding op echte SQLite. `fout`: 'prepare' of 'run' laat de database kapot gaan.
function maakD1({ fout = null } = {}) {
  const db = new DatabaseSync(':memory:')
  db.exec(SCHEMA)
  return {
    db,
    prepare(sql) {
      sqls.push(sql)
      if (fout === 'prepare') throw new Error('database kapot')
      const opdracht = db.prepare(sql)
      return {
        bind: (...args) => ({
          run: async () => {
            if (fout === 'run') throw new Error('database kapot')
            return opdracht.run(...args)
          },
        }),
      }
    },
  }
}
const rijen = (d1) =>
  d1.db
    .prepare('SELECT * FROM berichten ORDER BY aangemaakt')
    .all()
    .map((r) => ({ ...r }))

function maakOmgeving({ d1 = maakD1() } = {}) {
  const limiter = {
    async limit() {
      return { success: true }
    },
  }
  return {
    CONTACT_AAN: 'aan',
    RESEND_API_KEY: 'proef-sleutel',
    TURNSTILE_SECRET: 'proef-geheim',
    LIMIET_IP: limiter,
    LIMIET_ADRES: limiter,
    LIMIET_ALGEMEEN: limiter,
    LIMIET_CONTACT_IP: limiter,
    LIMIET_CONTACT_ADRES: limiter,
    LIMIET_CONTACT_ALGEMEEN: limiter,
    BLADMUZIEK: {
      get: async (sleutel) =>
        sleutel === 'bladmuziek/hart-van-glas.pdf'
          ? { size: PDF.length, arrayBuffer: async () => PDF.buffer }
          : null,
    },
    ...(d1 ? { BERICHTEN: d1 } : {}),
  }
}

// Nagebootste fetch: Turnstile (met de actie van het eindpunt) en Resend (een uitkomst per mail; 'netwerk' gooit)
function maakFetch({ actie, resend = [200, 200], turnstile } = {}) {
  let nummer = 0
  return async (url, init) => {
    gesprekken.push({ url: String(url), init })
    if (String(url).includes('turnstile'))
      return new Response(
        JSON.stringify(turnstile ?? { success: true, hostname: HOSTNAME, action: actie }),
      )
    const uit = resend[nummer++] ?? 200
    if (uit === 'netwerk') throw new Error('geen verbinding')
    return new Response(JSON.stringify({ id: 'proef' }), { status: uit })
  }
}

const verzoek = (pad, body, { host = HOSTNAME } = {}) =>
  new Request(`https://${host}${pad}`, {
    method: 'POST',
    headers: { origin: `https://${host}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
const contact = (body = CONTACT, env = maakOmgeving(), opties = {}, extra = {}) =>
  behandel(verzoek('/api/contact', body), env, {
    lijst: LIJST,
    fetch: maakFetch({ actie: 'contact', ...opties }),
    ...extra,
  })
const bladmuziek = (body = BLADMUZIEK, env = maakOmgeving(), opties = {}, extra = {}) =>
  behandel(verzoek('/api/bladmuziek', body), env, {
    lijst: LIJST,
    fetch: maakFetch({ actie: 'bladmuziek', ...opties }),
    ...extra,
  })
const resend = () => gesprekken.filter((g) => g.url.includes('resend'))
const json = async (res) => res.json()

beforeEach(() => {
  gesprekken = []
  logregels = []
  sqls = []
  origineel = { log: console.log, error: console.error, warn: console.warn }
  for (const k of ['log', 'error', 'warn']) console[k] = (...a) => logregels.push(a.join(' '))
})
afterEach(() => Object.assign(console, origineel))

describe('opslaan bij gelukt versturen', () => {
  test('contact: het bericht staat in de database, beide mails zijn verzonden', async () => {
    const env = maakOmgeving()
    const nu = new Date('2026-07-01T21:30:00Z') // 23:30 zomertijd: de dag is nog 1 juli in Amsterdam
    const res = await contact(
      { ...CONTACT, onderwerp: 'boeking', plaats: 'Verzonnen-stad', budget: 'nog niet bekend' },
      env,
      {},
      { nu: () => nu },
    )
    assert.equal(res.status, 200)
    assert.deepEqual(await json(res), { ok: true, bevestigingVerstuurd: true })
    const [r, ...rest] = rijen(env.BERICHTEN)
    assert.equal(rest.length, 0)
    assert.match(r.id, /^[0-9a-f-]{36}$/)
    assert.deepEqual(
      {
        soort: r.soort,
        onderwerp: r.onderwerp,
        naam: r.naam,
        email: r.email,
        bericht: r.bericht,
        dag: r.dag,
      },
      {
        soort: 'contact',
        onderwerp: 'boeking',
        naam: 'Proefpersoon Verzonnen',
        email: 'test@example.org',
        bericht: CONTACT.bericht,
        dag: '2026-07-01',
      },
    )
    assert.equal(r.aangemaakt, nu.toISOString())
    assert.deepEqual(JSON.parse(r.extra), { plaats: 'Verzonnen-stad', budget: 'nog niet bekend' })
    assert.deepEqual([r.status_hoofd, r.status_tweede, r.pogingen], ['verzonden', 'verzonden', 2])
    assert.equal(r.geanonimiseerd_op, null)
  })

  test('contact zonder boekingsvelden: extra is leeg', async () => {
    const env = maakOmgeving()
    await contact(CONTACT, env)
    assert.equal(rijen(env.BERICHTEN)[0].extra, null)
  })

  test('bladmuziek: soort, nummer en nieuwsbriefvlag; geen bericht; zonder nieuwsbrief geen tweede mail', async () => {
    const env = maakOmgeving()
    const res = await bladmuziek(BLADMUZIEK, env)
    assert.equal(res.status, 200)
    const [r] = rijen(env.BERICHTEN)
    assert.deepEqual(
      { soort: r.soort, onderwerp: r.onderwerp, naam: r.naam, email: r.email, bericht: r.bericht },
      {
        soort: 'bladmuziek',
        onderwerp: 'hart-van-glas',
        naam: 'Proefpersoon Verzonnen',
        email: 'test@example.org',
        bericht: null,
      },
    )
    assert.deepEqual(JSON.parse(r.extra), { nieuwsbrief: false })
    assert.deepEqual([r.status_hoofd, r.status_tweede, r.pogingen], ['verzonden', 'nvt', 1])
    assert.equal(resend().length, 1)
  })

  test('bladmuziek met nieuwsbrief: de tweede mail (aan hallo@) heeft zijn eigen status', async () => {
    const env = maakOmgeving()
    const res = await bladmuziek({ ...BLADMUZIEK, nieuwsbrief: true }, env)
    assert.deepEqual(await json(res), { ok: true, nieuwsbriefVerstuurd: true })
    const [r] = rijen(env.BERICHTEN)
    assert.deepEqual(JSON.parse(r.extra), { nieuwsbrief: true })
    assert.deepEqual([r.status_hoofd, r.status_tweede, r.pogingen], ['verzonden', 'verzonden', 2])
    // De tweede mail mislukt: de bezoeker heeft de pdf, de tweede status blijft op wacht (voor een nieuwe poging)
    const env2 = maakOmgeving()
    const res2 = await bladmuziek({ ...BLADMUZIEK, nieuwsbrief: true }, env2, {
      resend: [200, 500],
    })
    assert.deepEqual(await json(res2), { ok: true, nieuwsbriefVerstuurd: false })
    const [r2] = rijen(env2.BERICHTEN)
    assert.deepEqual([r2.status_hoofd, r2.status_tweede], ['verzonden', 'wacht'])
  })

  test('elke mail krijgt een Idempotency-Key met het id van het bericht', async () => {
    const env = maakOmgeving()
    await contact(CONTACT, env)
    const [r] = rijen(env.BERICHTEN)
    const sleutels = resend().map((g) => g.init.headers['idempotency-key'])
    assert.deepEqual(sleutels, [`${r.id}-hoofd`, `${r.id}-tweede`])
  })

  test('de dag volgt Europe/Amsterdam, niet UTC', () => {
    assert.equal(dagAmsterdam(new Date('2026-07-01T21:30:00Z')), '2026-07-01')
    assert.equal(dagAmsterdam(new Date('2026-07-01T22:30:00Z')), '2026-07-02')
    assert.equal(dagAmsterdam(new Date('2026-12-31T22:30:00Z')), '2026-12-31')
    assert.equal(dagAmsterdam(new Date('2026-12-31T23:30:00Z')), '2027-01-01')
  })
})

describe('zonder binding of met een kapotte database: het versturen gaat gewoon door', () => {
  test('zonder binding: dezelfde uitkomst en geen Idempotency-Key', async () => {
    for (const aanroep of [contact, bladmuziek]) {
      gesprekken = []
      const res = await aanroep(
        aanroep === contact ? CONTACT : BLADMUZIEK,
        maakOmgeving({ d1: null }),
      )
      assert.equal(res.status, 200)
      assert.ok(resend().length >= 1)
      for (const g of resend()) assert.equal(g.init.headers['idempotency-key'], undefined)
    }
  })

  test('de database geeft een fout (bij voorbereiden of uitvoeren): 200 en de mails zijn verzonden, niets gelogd', async () => {
    for (const fout of ['prepare', 'run']) {
      for (const aanroep of [contact, bladmuziek]) {
        gesprekken = []
        const env = maakOmgeving({ d1: maakD1({ fout }) })
        const res = await aanroep(aanroep === contact ? CONTACT : BLADMUZIEK, env)
        assert.equal(res.status, 200, `${fout} ${aanroep.name}`)
        assert.ok(resend().length >= 1)
        assert.equal(rijen(maakD1()).length, 0)
        for (const g of resend())
          assert.equal(
            g.init.headers['idempotency-key'],
            undefined,
            'niet opgeslagen: geen sleutel',
          )
      }
    }
    assert.deepEqual(logregels, [])
  })

  test('de database geeft een fout en de mail mislukt ook: de fout van de mail (zoals zonder opslag)', async () => {
    const env = maakOmgeving({ d1: maakD1({ fout: 'run' }) })
    assert.equal((await contact(CONTACT, env, { resend: [500] })).status, 502)
    assert.equal((await contact(CONTACT, env, { resend: [429] })).status, 503)
    assert.equal((await bladmuziek(BLADMUZIEK, env, { resend: [500] })).status, 502)
    assert.equal((await bladmuziek(BLADMUZIEK, env, { resend: [429] })).status, 503)
  })
})

describe('de mail mislukt', () => {
  test('tijdelijk (500, 429, geen verbinding) met opgeslagen bericht: 200 met later, status blijft wacht', async () => {
    for (const uit of [500, 503, 429, 'netwerk']) {
      for (const [aanroep, body, extra] of [
        [contact, CONTACT, { bevestigingVerstuurd: false }],
        [bladmuziek, BLADMUZIEK, { nieuwsbriefVerstuurd: false }],
      ]) {
        const env = maakOmgeving()
        const res = await aanroep(body, env, { resend: [uit] })
        assert.equal(res.status, 200, `${uit} ${aanroep.name}`)
        assert.deepEqual(await json(res), { ok: true, later: true, ...extra })
        const [r] = rijen(env.BERICHTEN)
        assert.equal(r.status_hoofd, 'wacht', `${uit} ${aanroep.name}`)
        assert.equal(r.pogingen, 1)
        assert.ok(r.laatste_poging)
        // het adres en het bericht staan er nog (voor de nieuwe poging)
        assert.equal(r.email, 'test@example.org')
      }
    }
  })

  test('de bevestiging mislukt tijdelijk: het bericht is aangekomen, die status blijft wacht', async () => {
    const env = maakOmgeving()
    const res = await contact(CONTACT, env, { resend: [200, 500] })
    assert.deepEqual(await json(res), { ok: true, bevestigingVerstuurd: false })
    const [r] = rijen(env.BERICHTEN)
    assert.deepEqual([r.status_hoofd, r.status_tweede], ['verzonden', 'wacht'])
  })

  test('permanent (een andere 4xx): status mislukt en 502', async () => {
    const env = maakOmgeving()
    const res = await bladmuziek(BLADMUZIEK, env, { resend: [422] })
    assert.equal(res.status, 502)
    assert.deepEqual(await json(res), { fout: 'verzenden_mislukt' })
    assert.equal(rijen(env.BERICHTEN)[0].status_hoofd, 'mislukt')
    const env2 = maakOmgeving()
    assert.equal((await contact(CONTACT, env2, { resend: [400] })).status, 502)
    assert.equal(rijen(env2.BERICHTEN)[0].status_hoofd, 'mislukt')
  })
})

describe('wat niet wordt opgeslagen', () => {
  test('geen opslag bij een ongeldig verzoek, honeypot, mislukte Turnstile, limiet, geen pdf, ander adres of uitgeschakeld', async () => {
    const limiet = {
      async limit() {
        return { success: false }
      },
    }
    const gevallen = [
      ['contact ongeldig', (e) => contact({ ...CONTACT, email: 'kapot' }, e)],
      ['contact honeypot', (e) => contact({ ...CONTACT, website: 'http://x' }, e)],
      ['contact Turnstile', (e) => contact(CONTACT, e, { turnstile: { success: false } })],
      ['contact limiet', (e) => contact(CONTACT, { ...e, LIMIET_CONTACT_ADRES: limiet })],
      ['contact uit', (e) => contact(CONTACT, { ...e, CONTACT_AAN: undefined })],
      [
        'contact ander adres',
        (e) =>
          behandel(
            verzoek('/api/contact', CONTACT, {
              host: 'preview-pr-1-mariellemadern.mmadern.workers.dev',
            }),
            e,
            { lijst: LIJST, fetch: maakFetch({ actie: 'contact' }) },
          ),
      ],
      ['bladmuziek ongeldig', (e) => bladmuziek({ ...BLADMUZIEK, nummer: 'bestaat-niet' }, e)],
      ['bladmuziek honeypot', (e) => bladmuziek({ ...BLADMUZIEK, website: 'x' }, e)],
      ['bladmuziek Turnstile', (e) => bladmuziek(BLADMUZIEK, e, { turnstile: { success: false } })],
      ['bladmuziek limiet', (e) => bladmuziek(BLADMUZIEK, { ...e, LIMIET_ADRES: limiet })],
      [
        'bladmuziek geen pdf',
        (e) => bladmuziek(BLADMUZIEK, { ...e, BLADMUZIEK: { get: async () => null } }),
      ],
    ]
    for (const [naam, aanroep] of gevallen) {
      const env = maakOmgeving()
      await aanroep(env)
      assert.equal(rijen(env.BERICHTEN).length, 0, naam)
    }
  })
})

describe('privacy', () => {
  test('alle opdrachten aan de database zijn vast: niets van de bezoeker staat in de SQL, alleen in de parameters', async () => {
    const env = maakOmgeving()
    await contact(
      { ...CONTACT, naam: "Robert'); DROP TABLE berichten;--", bericht: 'geheim-bericht-xyz' },
      env,
    )
    await bladmuziek(BLADMUZIEK, env)
    assert.equal(sqls.length, 5)
    for (const sql of sqls) {
      assert.ok(!/Robert|DROP|geheim-bericht|test@example|Proefpersoon/.test(sql), sql)
      assert.match(sql, /^\s*(INSERT INTO berichten|UPDATE berichten)/)
    }
    // de tabel bestaat nog, met beide rijen
    assert.equal(rijen(env.BERICHTEN).length, 2)
    assert.equal(rijen(env.BERICHTEN)[0].naam, "Robert'); DROP TABLE berichten;--")
  })

  test('geen naam, adres of bericht in de antwoorden of de logs; niets bewaard of gelogd bij een fout', async () => {
    const antwoorden = []
    for (const [aanroep, body] of [
      [contact, CONTACT],
      [bladmuziek, BLADMUZIEK],
    ]) {
      for (const opties of [{}, { resend: [500] }, { resend: [422] }, { resend: ['netwerk'] }]) {
        antwoorden.push(await (await aanroep(body, maakOmgeving(), opties)).text())
      }
    }
    for (const tekst of [...antwoorden, ...logregels]) {
      assert.ok(
        !['Proefpersoon', 'test@example.org', 'verzonnen vraag'].some((x) => tekst.includes(x)),
        tekst,
      )
    }
    assert.deepEqual(logregels, [])
  })

  test('het schema heeft precies de afgesproken kolommen', () => {
    const d1 = maakD1()
    assert.deepEqual(
      d1.db
        .prepare('PRAGMA table_info(berichten)')
        .all()
        .map((k) => k.name),
      [
        'id',
        'soort',
        'aangemaakt',
        'dag',
        'onderwerp',
        'naam',
        'email',
        'bericht',
        'extra',
        'status_hoofd',
        'status_tweede',
        'pogingen',
        'laatste_poging',
        'geanonimiseerd_op',
      ],
    )
  })

  test('de README bevat precies de CREATE TABLE-opdracht uit de code, en wrangler.jsonc de binding met de database van de eigenaar', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf-8')
    assert.ok(readme.includes(SCHEMA), 'het schema in de README wijkt af van worker/opslag.mjs')
    const config = JSON.parse(
      readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf-8')
        .split('\n')
        .filter((regel) => !/^\s*\/\//.test(regel))
        .join('\n'),
    )
    assert.deepEqual(config.d1_databases, [
      {
        binding: 'BERICHTEN',
        database_name: 'marielle-madern',
        database_id: '74756d1e-94a8-4909-9165-14e6190d95d4',
      },
    ])
    // de SQL-voorbeelden in de README werken op het schema
    const d1 = maakD1()
    const voorbeelden = [...readme.matchAll(/```sql\n([\s\S]*?)```/g)]
      .map((m) => m[1])
      .filter((t) => t.includes('-- De laatste 20'))[0]
    assert.ok(voorbeelden)
    const opdrachten = voorbeelden
      .split('\n')
      .filter((r) => !r.startsWith('--'))
      .join('\n')
      .split(';')
      .map((t) => t.trim())
      .filter(Boolean)
    assert.equal(opdrachten.length, 7)
    for (const sql of opdrachten) d1.db.prepare(sql).all()
  })
})
