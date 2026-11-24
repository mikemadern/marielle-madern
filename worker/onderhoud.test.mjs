// Tests van het onderhoud (worker/onderhoud.mjs): opnieuw versturen en anonimiseren. De database is echte SQLite
// (node:sqlite, zoals D1); Resend en de bucket zijn nagebootst. Alle namen en adressen zijn verzonnen.
// Draaien: pnpm test:worker
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, test } from 'node:test'
import { onderhoud } from './onderhoud.mjs'
import { SCHEMA } from './opslag.mjs'

const LIJST = { 'hart-van-glas': { titel: 'Hart van glas' } }
const PDF = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10])
const NU = new Date('2026-12-01T12:00:00Z')
const uurGeleden = (u) => new Date(NU.getTime() - u * 3_600_000).toISOString()

let gesprekken
let logregels
let origineel
let sqls

function maakD1({ faalBij = null } = {}) {
  const db = new DatabaseSync(':memory:')
  db.exec(SCHEMA)
  return {
    db,
    prepare(sql) {
      sqls.push(sql)
      if (faalBij && sql.includes(faalBij)) throw new Error('database kapot')
      const opdracht = db.prepare(sql)
      return {
        bind: (...args) => ({
          run: async () => {
            const r = opdracht.run(...args)
            return { meta: { changes: Number(r.changes) } }
          },
          all: async () => ({ results: opdracht.all(...args).map((x) => ({ ...x })) }),
        }),
      }
    },
  }
}

// Zet een rij in de tabel
function zet(d1, r) {
  const rij = {
    id: crypto.randomUUID(),
    soort: 'contact',
    aangemaakt: uurGeleden(1),
    dag: '2026-12-01',
    onderwerp: 'vraag',
    naam: 'Proefpersoon Verzonnen',
    email: 'test@example.org',
    bericht: 'Een verzonnen vraag.',
    extra: null,
    status_hoofd: 'wacht',
    status_tweede: 'wacht',
    pogingen: 1,
    laatste_poging: uurGeleden(1),
    geanonimiseerd_op: null,
    ...r,
  }
  d1.db
    .prepare(
      `INSERT INTO berichten (id, soort, aangemaakt, dag, onderwerp, naam, email, bericht, extra, status_hoofd, status_tweede, pogingen, laatste_poging, geanonimiseerd_op)
       VALUES (:id, :soort, :aangemaakt, :dag, :onderwerp, :naam, :email, :bericht, :extra, :status_hoofd, :status_tweede, :pogingen, :laatste_poging, :geanonimiseerd_op)`,
    )
    .run(rij)
  return rij.id
}
const rij = (d1, id) => ({ ...d1.db.prepare('SELECT * FROM berichten WHERE id = ?').get(id) })

function maakEnv({ d1 = maakD1(), pdf = true } = {}) {
  return {
    RESEND_API_KEY: 'proef-sleutel',
    BREVO_API_KEY: 'proef-brevo-sleutel',
    BREVO_LIJST_ID: '4',
    BLADMUZIEK: {
      get: async (sleutel) =>
        pdf && sleutel === 'bladmuziek/hart-van-glas.pdf'
          ? { size: PDF.length, arrayBuffer: async () => PDF.buffer }
          : null,
    },
    ...(d1 ? { BERICHTEN: d1 } : {}),
  }
}

// Nagebootste fetch voor Resend (een uitkomst per mail) en Brevo (een uitkomst per aanroep)
function maakFetch(resend = [], brevo = []) {
  let n = 0
  let b = 0
  return async (url, init) => {
    gesprekken.push({ url: String(url), init })
    if (String(url).includes('brevo')) {
      const uitB = brevo[b++] ?? 201
      if (uitB === 'netwerk') throw new Error('geen verbinding')
      return new Response(JSON.stringify(uitB === 400 ? { code: 'duplicate_parameter' } : {}), {
        status: uitB,
      })
    }
    const uit = resend[n++] ?? 200
    if (uit === 'netwerk') throw new Error('geen verbinding')
    return new Response('{}', { status: uit })
  }
}
const draai = (env, resend = [], nu = NU, brevo = []) =>
  onderhoud(env, { lijst: LIJST, fetch: maakFetch(resend, brevo) }, nu)
const mails = () =>
  gesprekken
    .filter((g) => g.url.includes('resend'))
    .map((g) => ({
      ...JSON.parse(g.init.body),
      sleutel: g.init.headers['idempotency-key'],
    }))
const aanmeldingen = () =>
  gesprekken
    .filter((g) => g.url.includes('brevo'))
    .map((g) => ({ methode: g.init.method, url: g.url, body: JSON.parse(g.init.body) }))

beforeEach(() => {
  gesprekken = []
  logregels = []
  sqls = []
  origineel = { log: console.log, error: console.error, warn: console.warn }
  for (const k of ['log', 'error', 'warn']) console[k] = (...a) => logregels.push(a.join(' '))
})
afterEach(() => Object.assign(console, origineel))

describe('opnieuw versturen', () => {
  test('contact: de mail aan Mariëlle en daarna de bevestiging, met de Idempotency-Key van het bericht', async () => {
    const env = maakEnv()
    const id = zet(env.BERICHTEN, {
      extra: JSON.stringify({ plaats: 'Verzonnen-stad' }),
      onderwerp: 'boeking',
    })
    const uitkomst = await draai(env)
    assert.deepEqual(uitkomst, { verlopen: 0, herhaald: 1, gewist: 0, geanonimiseerd: 0 })
    const m = mails()
    assert.equal(m.length, 2)
    assert.deepEqual(m[0].to, ['hallo@mariellemadern.nl'])
    assert.equal(m[0].reply_to, 'test@example.org')
    assert.equal(m[0].subject, 'Contactformulier: Boeking (Proefpersoon Verzonnen)')
    assert.match(m[0].text, /Plaats: Verzonnen-stad/)
    assert.equal(m[0].sleutel, `${id}-hoofd`)
    assert.deepEqual(m[1].to, ['test@example.org'])
    assert.equal(m[1].sleutel, `${id}-tweede`)
    const r = rij(env.BERICHTEN, id)
    assert.deepEqual([r.status_hoofd, r.status_tweede, r.pogingen], ['verzonden', 'verzonden', 3])
  })

  test('alleen de tweede mail nog open: de hoofdmail wordt niet opnieuw verstuurd (geen dubbele mail)', async () => {
    const env = maakEnv()
    const id = zet(env.BERICHTEN, { status_hoofd: 'verzonden', status_tweede: 'wacht' })
    await draai(env)
    const m = mails()
    assert.equal(m.length, 1)
    assert.deepEqual(m[0].to, ['test@example.org'])
    assert.equal(rij(env.BERICHTEN, id).status_tweede, 'verzonden')
    // een bericht dat klaar is wordt niet aangeraakt
    gesprekken = []
    zet(env.BERICHTEN, { status_hoofd: 'verzonden', status_tweede: 'verzonden' })
    await draai(env)
    assert.equal(gesprekken.length, 0)
  })

  test('bladmuziek: de pdf wordt opnieuw uit de bucket gelezen, de mail gaat naar de bezoeker, de aanmelding bij Brevo daarna', async () => {
    const env = maakEnv()
    const id = zet(env.BERICHTEN, {
      soort: 'bladmuziek',
      onderwerp: 'hart-van-glas',
      bericht: null,
      dag: '2026-11-30',
      extra: JSON.stringify({ nieuwsbrief: true }),
    })
    await draai(env)
    const m = mails()
    assert.equal(m.length, 1)
    assert.deepEqual(m[0].to, ['test@example.org'])
    assert.equal(m[0].subject, 'De bladmuziek van Hart van glas')
    assert.equal(m[0].attachments[0].filename, 'bladmuziek-hart-van-glas.pdf')
    assert.equal(Buffer.from(m[0].attachments[0].content, 'base64').toString(), '%PDF-1.4\n')
    assert.equal(m[0].sleutel, `${id}-hoofd`)
    // geen mail aan Mariëlle meer; wel één aanmelding bij Brevo, met de dag van de eerste aanvraag
    assert.ok(m.every((x) => !x.to.includes('hallo@mariellemadern.nl')))
    const b = aanmeldingen()
    assert.equal(b.length, 1)
    assert.deepEqual(b[0].body, {
      email: 'test@example.org',
      listIds: [4],
      attributes: { BRON: 'bladmuziek:hart-van-glas', AANGEMELD_OP: '2026-11-30' },
    })
    assert.deepEqual(
      [rij(env.BERICHTEN, id).status_hoofd, rij(env.BERICHTEN, id).status_tweede],
      ['verzonden', 'verzonden'],
    )
  })

  test('alleen de aanmelding bij Brevo is nog open: de pdf wordt niet opnieuw verstuurd (geen dubbele mail)', async () => {
    const env = maakEnv()
    const id = zet(env.BERICHTEN, {
      soort: 'bladmuziek',
      onderwerp: 'hart-van-glas',
      bericht: null,
      extra: '{"nieuwsbrief":true}',
      status_hoofd: 'verzonden',
      status_tweede: 'wacht',
    })
    await draai(env)
    assert.equal(mails().length, 0)
    assert.equal(aanmeldingen().length, 1)
    assert.equal(rij(env.BERICHTEN, id).status_tweede, 'verzonden')
  })

  test('Brevo mislukt tijdelijk (500, 401, 429, geen verbinding): wacht blijft staan en de volgende keer wordt het opnieuw geprobeerd', async () => {
    for (const uit of [500, 401, 429, 'netwerk']) {
      const env = maakEnv()
      const id = zet(env.BERICHTEN, {
        soort: 'bladmuziek',
        onderwerp: 'hart-van-glas',
        bericht: null,
        extra: '{"nieuwsbrief":true}',
        status_hoofd: 'verzonden',
        status_tweede: 'wacht',
      })
      gesprekken = []
      await draai(env, [], NU, [uit])
      assert.equal(rij(env.BERICHTEN, id).status_tweede, 'wacht', String(uit))
      assert.equal(rij(env.BERICHTEN, id).pogingen, 2)
      // de volgende keer lukt het
      gesprekken = []
      await draai(env, [], new Date(NU.getTime() + 300_000), [201])
      assert.equal(rij(env.BERICHTEN, id).status_tweede, 'verzonden', String(uit))
      assert.equal(aanmeldingen().length, 1)
    }
  })

  test('Brevo keurt het adres voorgoed af: mislukt, en niet opnieuw proberen', async () => {
    const env = maakEnv()
    const id = zet(env.BERICHTEN, {
      soort: 'bladmuziek',
      onderwerp: 'hart-van-glas',
      bericht: null,
      extra: '{"nieuwsbrief":true}',
      status_hoofd: 'verzonden',
      status_tweede: 'wacht',
    })
    await draai(env, [], NU, [404])
    assert.equal(rij(env.BERICHTEN, id).status_tweede, 'mislukt')
    gesprekken = []
    await draai(env)
    assert.equal(gesprekken.length, 0)
  })

  test('Brevo blijft 24 uur weg: daarna mislukt, en er wordt niet meer geprobeerd', async () => {
    const env = maakEnv()
    const id = zet(env.BERICHTEN, {
      soort: 'bladmuziek',
      onderwerp: 'hart-van-glas',
      bericht: null,
      aangemaakt: uurGeleden(25),
      extra: '{"nieuwsbrief":true}',
      status_hoofd: 'verzonden',
      status_tweede: 'wacht',
    })
    const uitkomst = await draai(env)
    assert.equal(uitkomst.verlopen, 1)
    assert.equal(gesprekken.length, 0)
    assert.equal(rij(env.BERICHTEN, id).status_tweede, 'mislukt')
  })

  test('de nieuwsbrief is niet ingesteld (geen sleutel of lijstnummer): geen aanroep, de aanmelding wacht', async () => {
    for (const weg of ['BREVO_API_KEY', 'BREVO_LIJST_ID']) {
      const env = maakEnv()
      delete env[weg]
      const id = zet(env.BERICHTEN, {
        soort: 'bladmuziek',
        onderwerp: 'hart-van-glas',
        bericht: null,
        extra: '{"nieuwsbrief":true}',
        status_hoofd: 'verzonden',
        status_tweede: 'wacht',
      })
      gesprekken = []
      await draai(env)
      assert.equal(gesprekken.length, 0)
      assert.equal(rij(env.BERICHTEN, id).status_tweede, 'wacht')
    }
  })

  test('de pdf is weg of het nummer staat niet meer in de lijst: mislukt, geen mail', async () => {
    const env = maakEnv({ pdf: false })
    const id = zet(env.BERICHTEN, {
      soort: 'bladmuziek',
      onderwerp: 'hart-van-glas',
      bericht: null,
      extra: '{"nieuwsbrief":true}',
    })
    await draai(env)
    assert.equal(gesprekken.length, 0)
    assert.deepEqual(
      [rij(env.BERICHTEN, id).status_hoofd, rij(env.BERICHTEN, id).status_tweede],
      ['mislukt', 'mislukt'],
    )
    const env2 = maakEnv()
    const id2 = zet(env2.BERICHTEN, {
      soort: 'bladmuziek',
      onderwerp: 'bestaat-niet',
      bericht: null,
      extra: '{}',
    })
    await draai(env2)
    assert.equal(rij(env2.BERICHTEN, id2).status_hoofd, 'mislukt')
  })

  test('de mail mislukt weer tijdelijk: het blijft op wacht staan en de volgende keer wordt het opnieuw geprobeerd', async () => {
    for (const uit of [500, 429, 'netwerk']) {
      const env = maakEnv()
      const id = zet(env.BERICHTEN, {})
      gesprekken = []
      await draai(env, [uit])
      assert.equal(gesprekken.length, 1, String(uit))
      assert.equal(rij(env.BERICHTEN, id).status_hoofd, 'wacht', String(uit))
      assert.equal(rij(env.BERICHTEN, id).status_tweede, 'wacht')
      assert.equal(rij(env.BERICHTEN, id).pogingen, 2)
      // de volgende keer lukt het
      gesprekken = []
      await draai(env, [200, 200])
      assert.deepEqual(
        [rij(env.BERICHTEN, id).status_hoofd, rij(env.BERICHTEN, id).status_tweede],
        ['verzonden', 'verzonden'],
      )
    }
  })

  test('de mail mislukt voorgoed (een andere 4xx): mislukt, en de bevestiging wordt niet meer verstuurd', async () => {
    const env = maakEnv()
    const id = zet(env.BERICHTEN, {})
    await draai(env, [422])
    assert.equal(gesprekken.length, 1)
    assert.deepEqual(
      [rij(env.BERICHTEN, id).status_hoofd, rij(env.BERICHTEN, id).status_tweede],
      ['mislukt', 'mislukt'],
    )
  })

  test('hooguit 20 berichten per keer, de oudste eerst', async () => {
    const env = maakEnv()
    const ids = []
    for (let i = 0; i < 25; i++)
      ids.push(
        zet(env.BERICHTEN, { aangemaakt: uurGeleden(20 - i * 0.5), status_tweede: 'verzonden' }),
      )
    const uitkomst = await draai(env)
    assert.equal(uitkomst.herhaald, 20)
    assert.equal(gesprekken.length, 20)
    const verstuurd = ids.filter((id) => rij(env.BERICHTEN, id).status_hoofd === 'verzonden')
    assert.deepEqual(verstuurd, ids.slice(0, 20))
  })

  test('een fout bij één bericht houdt de andere niet tegen', async () => {
    const env = maakEnv()
    const kapot = zet(env.BERICHTEN, { aangemaakt: uurGeleden(5), extra: '{kapot-json' })
    const goed = zet(env.BERICHTEN, { aangemaakt: uurGeleden(4) })
    const uitkomst = await draai(env)
    assert.equal(uitkomst.herhaald, 1)
    assert.equal(rij(env.BERICHTEN, kapot).status_hoofd, 'wacht')
    assert.equal(rij(env.BERICHTEN, goed).status_hoofd, 'verzonden')
  })
})

describe('na 24 uur: mislukt', () => {
  test('wat na 24 uur nog op wacht staat wordt mislukt en niet meer geprobeerd; wat klaar is blijft', async () => {
    const env = maakEnv()
    const oud = zet(env.BERICHTEN, { aangemaakt: uurGeleden(25) })
    const oudHalf = zet(env.BERICHTEN, {
      aangemaakt: uurGeleden(26),
      status_hoofd: 'verzonden',
      status_tweede: 'wacht',
    })
    const klaar = zet(env.BERICHTEN, {
      aangemaakt: uurGeleden(30),
      status_hoofd: 'verzonden',
      status_tweede: 'verzonden',
    })
    const uitkomst = await draai(env)
    assert.equal(uitkomst.verlopen, 2)
    assert.equal(gesprekken.length, 0)
    assert.deepEqual(
      [rij(env.BERICHTEN, oud).status_hoofd, rij(env.BERICHTEN, oud).status_tweede],
      ['mislukt', 'mislukt'],
    )
    assert.deepEqual(
      [rij(env.BERICHTEN, oudHalf).status_hoofd, rij(env.BERICHTEN, oudHalf).status_tweede],
      ['verzonden', 'mislukt'],
    )
    assert.deepEqual(
      [rij(env.BERICHTEN, klaar).status_hoofd, rij(env.BERICHTEN, klaar).status_tweede],
      ['verzonden', 'verzonden'],
    )
  })
})

describe('anonimiseren na 30 dagen', () => {
  test('naam, adres, bericht en extra verdwijnen; dag, soort, onderwerp en statussen blijven', async () => {
    const env = maakEnv()
    const id = zet(env.BERICHTEN, {
      dag: '2026-10-25',
      aangemaakt: '2026-10-25T09:30:00.000Z',
      onderwerp: 'boeking',
      extra: '{"plaats":"Verzonnen-stad"}',
      status_hoofd: 'verzonden',
      status_tweede: 'verzonden',
    })
    const uitkomst = await draai(env)
    assert.equal(uitkomst.geanonimiseerd, 1)
    const r = rij(env.BERICHTEN, id)
    assert.deepEqual(r, {
      id,
      soort: 'contact',
      aangemaakt: '2026-10-25',
      dag: '2026-10-25',
      onderwerp: 'boeking',
      naam: null,
      email: null,
      bericht: null,
      extra: null,
      status_hoofd: 'verzonden',
      status_tweede: 'verzonden',
      pogingen: null,
      laatste_poging: null,
      geanonimiseerd_op: '2026-12-01',
    })
    // een tweede keer verandert er niets meer
    assert.equal((await draai(env)).geanonimiseerd, 0)
  })

  test('de grens ligt op 30 dagen (dag in Europe/Amsterdam): jonger blijft leesbaar', async () => {
    const env = maakEnv()
    const jong = zet(env.BERICHTEN, {
      dag: '2026-11-02',
      status_hoofd: 'verzonden',
      status_tweede: 'verzonden',
    }) // 29 dagen
    const grens = zet(env.BERICHTEN, {
      dag: '2026-11-01',
      status_hoofd: 'verzonden',
      status_tweede: 'verzonden',
    }) // 30 dagen
    const oud = zet(env.BERICHTEN, {
      dag: '2026-10-31',
      status_hoofd: 'verzonden',
      status_tweede: 'verzonden',
    }) // 31 dagen
    await draai(env)
    assert.equal(rij(env.BERICHTEN, jong).naam, 'Proefpersoon Verzonnen')
    assert.equal(rij(env.BERICHTEN, grens).naam, 'Proefpersoon Verzonnen')
    assert.equal(rij(env.BERICHTEN, oud).naam, null)
  })

  test('ook mislukte berichten worden geanonimiseerd; berichten die nog op wacht staan niet', async () => {
    const env = maakEnv()
    const mislukt = zet(env.BERICHTEN, {
      dag: '2026-10-01',
      status_hoofd: 'mislukt',
      status_tweede: 'mislukt',
    })
    // een oud bericht dat op wacht staat wordt eerst mislukt (na 24 uur), dan geanonimiseerd, in dezelfde keer
    const verlopen = zet(env.BERICHTEN, {
      dag: '2026-10-01',
      aangemaakt: '2026-10-01T10:00:00.000Z',
    })
    await draai(env)
    assert.equal(rij(env.BERICHTEN, mislukt).email, null)
    assert.equal(rij(env.BERICHTEN, verlopen).email, null)
    assert.equal(rij(env.BERICHTEN, verlopen).status_hoofd, 'mislukt')
    assert.equal(gesprekken.length, 0)
  })

  test('de statistiek blijft: de aantallen per onderwerp en maand na het anonimiseren', async () => {
    const env = maakEnv()
    for (const [dag, onderwerp] of [
      ['2026-10-01', 'spiegel'],
      ['2026-10-02', 'spiegel'],
      ['2026-10-03', 'in-het-licht'],
    ])
      zet(env.BERICHTEN, {
        soort: 'bladmuziek',
        dag,
        onderwerp,
        bericht: null,
        status_hoofd: 'verzonden',
        status_tweede: 'nvt',
      })
    await draai(env)
    const telling = env.BERICHTEN.db
      .prepare(
        "SELECT onderwerp, count(*) AS n FROM berichten WHERE soort = 'bladmuziek' GROUP BY onderwerp ORDER BY onderwerp",
      )
      .all()
      .map((r) => ({ ...r }))
    assert.deepEqual(telling, [
      { onderwerp: 'in-het-licht', n: 1 },
      { onderwerp: 'spiegel', n: 2 },
    ])
    assert.equal(
      env.BERICHTEN.db.prepare('SELECT count(*) AS n FROM berichten WHERE email IS NOT NULL').get()
        .n,
      0,
    )
  })
})

describe('aanmeldingen voor de nieuwsbrief via het losse formulier', () => {
  const nieuwsbrief = (env, r = {}) =>
    zet(env.BERICHTEN, {
      soort: 'nieuwsbrief',
      onderwerp: 'formulier',
      naam: 'Anna',
      bericht: null,
      extra: JSON.stringify({ achternaam: 'Jansen' }),
      status_hoofd: 'wacht',
      status_tweede: 'nvt',
      dag: '2026-11-30',
      ...r,
    })
  const leeg = (d1, id) => {
    const x = rij(d1, id)
    return [x.naam, x.email, x.bericht, x.extra]
  }

  test('opnieuw proberen: één aanroep naar Brevo met adres, voornaam (naam) en achternaam (extra) en de dag van de eerste keer; daarna gewist', async () => {
    const env = maakEnv()
    const id = nieuwsbrief(env)
    await draai(env)
    assert.equal(mails().length, 0)
    const b = aanmeldingen()
    assert.equal(b.length, 1)
    assert.deepEqual(b[0].body, {
      email: 'test@example.org',
      listIds: [4],
      attributes: {
        FIRSTNAME: 'Anna',
        LASTNAME: 'Jansen',
        BRON: 'formulier',
        AANGEMELD_OP: '2026-11-30',
      },
    })
    const r = rij(env.BERICHTEN, id)
    assert.equal(r.status_hoofd, 'verzonden')
    assert.deepEqual(leeg(env.BERICHTEN, id), [null, null, null, null])
  })

  test('alleen het adres: geen namen in de aanroep', async () => {
    const env = maakEnv()
    nieuwsbrief(env, { naam: null, extra: null })
    await draai(env)
    assert.deepEqual(aanmeldingen()[0].body.attributes, {
      BRON: 'formulier',
      AANGEMELD_OP: '2026-11-30',
    })
  })

  test('Brevo weer tijdelijk weg: de rij wacht met adres en namen; de volgende keer lukt het en dan zijn ze gewist', async () => {
    for (const uit of [500, 401, 429, 'netwerk']) {
      const env = maakEnv()
      const id = nieuwsbrief(env)
      gesprekken = []
      await draai(env, [], NU, [uit])
      let r = rij(env.BERICHTEN, id)
      assert.equal(r.status_hoofd, 'wacht', String(uit))
      assert.equal(r.email, 'test@example.org')
      assert.equal(r.naam, 'Anna')
      assert.equal(r.pogingen, 2)
      gesprekken = []
      await draai(env, [], new Date(NU.getTime() + 300_000), [201])
      r = rij(env.BERICHTEN, id)
      assert.equal(r.status_hoofd, 'verzonden', String(uit))
      assert.deepEqual(leeg(env.BERICHTEN, id), [null, null, null, null])
    }
  })

  test('Brevo keurt het adres voorgoed af: mislukt, meteen gewist, niet opnieuw proberen', async () => {
    const env = maakEnv()
    const id = nieuwsbrief(env)
    await draai(env, [], NU, [404])
    assert.equal(rij(env.BERICHTEN, id).status_hoofd, 'mislukt')
    assert.deepEqual(leeg(env.BERICHTEN, id), [null, null, null, null])
    gesprekken = []
    await draai(env)
    assert.equal(gesprekken.length, 0)
  })

  test('na 24 uur: mislukt en in dezelfde run gewist, zonder nog een aanroep', async () => {
    const env = maakEnv()
    const id = nieuwsbrief(env, { aangemaakt: uurGeleden(25) })
    const uitkomst = await draai(env)
    assert.equal(uitkomst.verlopen, 1)
    assert.equal(uitkomst.gewist, 1)
    assert.equal(gesprekken.length, 0)
    assert.equal(rij(env.BERICHTEN, id).status_hoofd, 'mislukt')
    assert.deepEqual(leeg(env.BERICHTEN, id), [null, null, null, null])
  })

  test('vangnet: een klaar bericht waar het wissen niet lukte, wordt door de Cron alsnog gewist', async () => {
    const env = maakEnv()
    const id = nieuwsbrief(env, { status_hoofd: 'verzonden' })
    const uitkomst = await draai(env)
    assert.equal(uitkomst.gewist, 1)
    assert.equal(gesprekken.length, 0)
    assert.deepEqual(leeg(env.BERICHTEN, id), [null, null, null, null])
    // en een volgende keer is er niets meer te doen
    assert.equal((await draai(env)).gewist, 0)
  })

  test('het wissen raakt alleen nieuwsbrief-rijen die klaar zijn: een bladmuziekaanvraag en een rij die wacht blijven', async () => {
    const env = maakEnv()
    const blad = zet(env.BERICHTEN, {
      soort: 'bladmuziek',
      onderwerp: 'hart-van-glas',
      bericht: null,
      extra: '{"nieuwsbrief":true}',
      status_hoofd: 'verzonden',
      status_tweede: 'verzonden',
    })
    const contact = zet(env.BERICHTEN, { status_hoofd: 'verzonden', status_tweede: 'verzonden' })
    const wacht = nieuwsbrief(env)
    await draai(env, [], NU, [500])
    assert.equal(rij(env.BERICHTEN, blad).email, 'test@example.org')
    assert.equal(rij(env.BERICHTEN, contact).email, 'test@example.org')
    assert.equal(rij(env.BERICHTEN, wacht).email, 'test@example.org')
  })

  test('de contact- en bladmuziekstappen werken nog (geen invloed op andere soorten)', async () => {
    const env = maakEnv()
    const id = zet(env.BERICHTEN, {})
    await draai(env)
    assert.equal(mails().length, 2)
    assert.equal(rij(env.BERICHTEN, id).status_tweede, 'verzonden')
    assert.equal(aanmeldingen().length, 0)
  })

  test('niet ingesteld (geen sleutel of lijstnummer): geen aanroep, de rij wacht met zijn gegevens', async () => {
    for (const weg of ['BREVO_API_KEY', 'BREVO_LIJST_ID']) {
      const env = maakEnv()
      delete env[weg]
      const id = nieuwsbrief(env)
      gesprekken = []
      await draai(env)
      assert.equal(gesprekken.length, 0)
      assert.equal(rij(env.BERICHTEN, id).status_hoofd, 'wacht')
      assert.equal(rij(env.BERICHTEN, id).email, 'test@example.org')
    }
  })

  test('na 30 dagen is er van een klaar bericht alleen dag, soort, bron en status over', async () => {
    const env = maakEnv()
    const id = nieuwsbrief(env, { dag: '2026-10-01', status_hoofd: 'verzonden' })
    await draai(env)
    const r = rij(env.BERICHTEN, id)
    assert.deepEqual(
      [r.soort, r.onderwerp, r.status_hoofd],
      ['nieuwsbrief', 'formulier', 'verzonden'],
    )
    assert.ok(r.geanonimiseerd_op)
    assert.deepEqual(leeg(env.BERICHTEN, id), [null, null, null, null])
  })
})

describe('veilig', () => {
  test('zonder binding: niets doen', async () => {
    assert.deepEqual(await draai(maakEnv({ d1: null })), {
      verlopen: 0,
      herhaald: 0,
      gewist: 0,
      geanonimiseerd: 0,
    })
    assert.equal(gesprekken.length, 0)
  })

  test('een fout in één stap houdt de andere niet tegen, niets gelogd, en de uitkomst bevat alleen aantallen', async () => {
    const d1 = maakD1({ faalBij: 'SELECT id' })
    const env = maakEnv({ d1 })
    zet(d1, { dag: '2026-10-01', status_hoofd: 'verzonden', status_tweede: 'verzonden' })
    const uitkomst = await draai(env)
    assert.deepEqual(uitkomst, { verlopen: 0, herhaald: 0, gewist: 0, geanonimiseerd: 1 })
    assert.deepEqual(logregels, [])
    for (const v of Object.values(uitkomst)) assert.equal(typeof v, 'number')
  })

  test('alle opdrachten zijn vast en gebruiken parameters: geen gegevens van bezoekers in de SQL', async () => {
    const env = maakEnv()
    zet(env.BERICHTEN, { naam: "Robert'); DROP TABLE berichten;--", bericht: 'geheim-bericht-xyz' })
    await draai(env)
    assert.ok(sqls.length >= 4)
    for (const sql of sqls)
      assert.ok(!/Robert|DROP TABLE|geheim-bericht|test@example|Proefpersoon/.test(sql), sql)
    assert.equal(env.BERICHTEN.db.prepare('SELECT count(*) AS n FROM berichten').get().n, 1)
  })

  test('de mails bevatten geen opgeslagen gegevens buiten wat de mail zelf nodig heeft: de bevestiging blijft vaste tekst', async () => {
    const env = maakEnv()
    zet(env.BERICHTEN, {
      naam: 'Verzonnen <b>Naam</b>',
      bericht: 'Klik op https://kwaad.example nu',
      status_hoofd: 'verzonden',
    })
    await draai(env)
    const bevestiging = mails()[0]
    assert.deepEqual(bevestiging.to, ['test@example.org'])
    const alles = JSON.stringify(bevestiging)
    for (const verboden of ['Verzonnen', 'kwaad.example', '<b>'])
      assert.ok(!alles.includes(verboden), verboden)
  })
})
