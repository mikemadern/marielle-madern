// Tests van de aanmelding voor de nieuwsbrief bij Brevo (worker/brevo.mjs). Brevo is nagebootst: er gaat geen echte
// aanroep weg en er is geen echte sleutel. Alle adressen en sleutels zijn verzonnen.
// Draaien: pnpm test:worker
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, test } from 'node:test'
import { BREVO, brevoAan, lijstId, meldAan } from './brevo.mjs'

const ENV = { BREVO_API_KEY: 'proef-brevo-sleutel', BREVO_LIJST_ID: '4' }
const ADRES = 'test@example.org'
const DAG = '2026-11-24'

let aanroepen
let logregels
let origineel

// Nagebootste Brevo: een uitkomst per aanroep, [status, body] of 'netwerk' (gooit) of 'timeout'
function maakFetch(uitkomsten) {
  let n = 0
  return async (url, init) => {
    aanroepen.push({
      url: String(url),
      methode: init.method,
      headers: init.headers,
      body: JSON.parse(init.body),
    })
    const uit = uitkomsten[n++] ?? [201, { id: 1 }]
    if (uit === 'netwerk') throw new Error('geen verbinding')
    if (uit === 'timeout') throw new DOMException('time-out', 'TimeoutError')
    return new Response(uit[1] === undefined ? null : JSON.stringify(uit[1]), { status: uit[0] })
  }
}
const aanmelden = (uitkomsten, env = ENV, bron = 'formulier') =>
  meldAan(env, { fetch: maakFetch(uitkomsten) }, { email: ADRES, bron, dag: DAG })

beforeEach(() => {
  aanroepen = []
  logregels = []
  origineel = { log: console.log, error: console.error, warn: console.warn }
  for (const k of ['log', 'error', 'warn']) console[k] = (...a) => logregels.push(a.join(' '))
})
afterEach(() => Object.assign(console, origineel))

describe('het lijstnummer en of de nieuwsbrief aan staat', () => {
  test('BREVO_LIJST_ID: een positief geheel getal, anders null', () => {
    assert.equal(lijstId({ BREVO_LIJST_ID: '4' }), 4)
    assert.equal(lijstId({ BREVO_LIJST_ID: ' 12 ' }), 12)
    for (const slecht of [
      undefined,
      '',
      '0',
      '-1',
      '4.5',
      '4a',
      'vier',
      '04',
      '1e3',
      '99999999999',
      null,
    ])
      assert.equal(lijstId({ BREVO_LIJST_ID: slecht }), null, String(slecht))
  })
  test('aan alleen met de sleutel én een geldig lijstnummer', () => {
    assert.equal(brevoAan(ENV), true)
    assert.equal(brevoAan({ BREVO_LIJST_ID: '4' }), false)
    assert.equal(brevoAan({ BREVO_API_KEY: 'x' }), false)
    assert.equal(brevoAan({ BREVO_API_KEY: 'x', BREVO_LIJST_ID: 'vier' }), false)
  })
  test('niet geconfigureerd: later, en geen enkele aanroep', async () => {
    for (const env of [
      {},
      { BREVO_LIJST_ID: '4' },
      { BREVO_API_KEY: 'x' },
      { ...ENV, BREVO_LIJST_ID: 'vier' },
    ])
      assert.equal(await aanmelden([], env), 'later')
    assert.equal(aanroepen.length, 0)
  })
})

describe('een nieuw adres', () => {
  test('één POST met alleen het adres, de lijst en de twee attributen; de sleutel in de kop', async () => {
    assert.equal(await aanmelden([[201, { id: 21 }]], ENV, 'bladmuziek:hart-van-glas'), 'ok')
    assert.equal(aanroepen.length, 1)
    const [a] = aanroepen
    assert.equal(a.url, 'https://api.brevo.com/v3/contacts')
    assert.equal(a.url, BREVO)
    assert.equal(a.methode, 'POST')
    assert.equal(a.headers['api-key'], 'proef-brevo-sleutel')
    assert.equal(a.headers['content-type'], 'application/json')
    // precies deze velden: geen naam, geen IP-adres, geen blokkade of update-vlag
    assert.deepEqual(a.body, {
      email: ADRES,
      listIds: [4],
      attributes: { BRON: 'bladmuziek:hart-van-glas', AANGEMELD_OP: DAG },
    })
  })
  test('zonder opgegeven dag staat de dag van vandaag (Europe/Amsterdam) in AANGEMELD_OP', async () => {
    await meldAan(ENV, { fetch: maakFetch([]) }, { email: ADRES, bron: 'formulier' })
    assert.match(aanroepen[0].body.attributes.AANGEMELD_OP, /^\d{4}-\d{2}-\d{2}$/)
  })
  test('een lijstnummer uit de variabele gaat als getal mee', async () => {
    await aanmelden([], { ...ENV, BREVO_LIJST_ID: '17' })
    assert.deepEqual(aanroepen[0].body.listIds, [17])
  })
})

describe('een adres dat al bestaat', () => {
  test('400 duplicate_parameter: een PUT met alleen de lijst, zodat bron en datum van de eerste keer blijven', async () => {
    const uit = await aanmelden([
      [400, { code: 'duplicate_parameter', message: 'Contact already exist' }],
      [204],
    ])
    assert.equal(uit, 'ok')
    assert.equal(aanroepen.length, 2)
    const put = aanroepen[1]
    assert.equal(put.methode, 'PUT')
    assert.equal(put.url, 'https://api.brevo.com/v3/contacts/test%40example.org')
    assert.equal(put.headers['api-key'], 'proef-brevo-sleutel')
    assert.deepEqual(put.body, { listIds: [4] })
  })
  test('het adres staat url-gecodeerd in het pad (plusje, apostrof, schuine streep)', async () => {
    const adres = "a+b/c'd@example.org"
    await meldAan(
      ENV,
      { fetch: maakFetch([[400, { code: 'duplicate_parameter' }], [204]]) },
      { email: adres, bron: 'formulier', dag: DAG },
    )
    assert.equal(aanroepen[1].url, `https://api.brevo.com/v3/contacts/${encodeURIComponent(adres)}`)
    assert.ok(!aanroepen[1].url.slice(BREVO.length + 1).includes('/'))
  })
  test('nieuw en bestaand geven dezelfde uitkomst: ok (de bezoeker merkt het verschil niet)', async () => {
    assert.equal(await aanmelden([[201, { id: 1 }]]), 'ok')
    assert.equal(await aanmelden([[400, { code: 'duplicate_parameter' }], [204]]), 'ok')
    assert.equal(await aanmelden([[400, { code: 'duplicate_parameter' }], [200]]), 'ok')
  })
  test('emailBlacklisted wordt nooit meegestuurd: wie zich heeft uitgeschreven, wordt niet stilletjes teruggezet', async () => {
    await aanmelden([[400, { code: 'duplicate_parameter' }], [204]])
    for (const a of aanroepen) {
      assert.ok(!('emailBlacklisted' in a.body))
      assert.ok(!('updateEnabled' in a.body))
      assert.ok(!('unlinkListIds' in a.body))
    }
  })
  test('de PUT mislukt tijdelijk of voorgoed: later of permanent', async () => {
    assert.equal(await aanmelden([[400, { code: 'duplicate_parameter' }], [500]]), 'later')
    assert.equal(await aanmelden([[400, { code: 'duplicate_parameter' }], 'netwerk']), 'later')
    assert.equal(
      await aanmelden([
        [400, { code: 'duplicate_parameter' }],
        [400, { code: 'invalid_parameter' }],
      ]),
      'permanent',
    )
  })
})

describe('een attribuut dat in Brevo nog niet bestaat', () => {
  test('400 invalid_parameter: één keer opnieuw zonder attributen (een aanmelding wordt nooit tegengehouden)', async () => {
    const uit = await aanmelden([
      [400, { code: 'invalid_parameter', message: 'Invalid attribute' }],
      [201, { id: 3 }],
    ])
    assert.equal(uit, 'ok')
    assert.equal(aanroepen.length, 2)
    assert.ok('attributes' in aanroepen[0].body)
    assert.deepEqual(aanroepen[1].body, { email: ADRES, listIds: [4] })
  })
  test('ontbrekend attribuut en het adres bestaat al: ook dan komt het adres op de lijst', async () => {
    const uit = await aanmelden([
      [400, { code: 'invalid_parameter' }],
      [400, { code: 'duplicate_parameter' }],
      [204],
    ])
    assert.equal(uit, 'ok')
    assert.deepEqual(
      aanroepen.map((a) => a.methode),
      ['POST', 'POST', 'PUT'],
    )
  })
  test('een ongeldig adres geeft ook invalid_parameter, ook zonder attributen: permanent, na precies twee aanroepen', async () => {
    const uit = await aanmelden([
      [400, { code: 'invalid_parameter' }],
      [400, { code: 'invalid_parameter' }],
    ])
    assert.equal(uit, 'permanent')
    assert.equal(aanroepen.length, 2)
  })
})

describe('als Brevo niet goed antwoordt', () => {
  test('geen verbinding, time-out, 429, 5xx, 401 en 403: later (opnieuw proberen kan slagen)', async () => {
    for (const uit of [
      'netwerk',
      'timeout',
      [429, { code: 'too_many_requests' }],
      [500],
      [502],
      [503],
      [401, { code: 'unauthorized' }],
      [403],
    ])
      assert.equal(await aanmelden([uit]), 'later', JSON.stringify(uit))
  })
  test('een andere 400, 404 of 422: permanent (opnieuw proberen helpt niet)', async () => {
    for (const uit of [[400, { code: 'missing_parameter' }], [400], [404], [422]])
      assert.equal(await aanmelden([uit]), 'permanent', JSON.stringify(uit))
  })
  test('een antwoord zonder JSON of met onzin: geen uitzondering', async () => {
    const f = async () => new Response('geen json', { status: 400 })
    assert.equal(
      await meldAan(ENV, { fetch: f }, { email: ADRES, bron: 'formulier', dag: DAG }),
      'permanent',
    )
  })
  test('elke aanroep heeft een time-out (signal), zodat de bezoeker niet te lang wacht', async () => {
    let signal
    const f = async (url, init) => {
      signal = init.signal
      return new Response('{}', { status: 201 })
    }
    await meldAan(ENV, { fetch: f }, { email: ADRES, bron: 'formulier', dag: DAG })
    assert.ok(signal instanceof AbortSignal)
  })
})

describe('privacy', () => {
  test('de sleutel staat alleen in de kop van de aanroep, nooit in de body, de uitslag of wat er gelogd wordt', async () => {
    for (const uit of [[201], [500], 'netwerk', [400, { code: 'duplicate_parameter' }]]) {
      aanroepen = []
      const uitslag = await aanmelden([uit, [204]])
      assert.ok(['ok', 'later', 'permanent'].includes(uitslag))
      for (const a of aanroepen) {
        assert.ok(!JSON.stringify(a.body).includes('proef-brevo-sleutel'))
        assert.ok(!a.url.includes('proef-brevo-sleutel'))
      }
    }
    assert.deepEqual(logregels, [])
  })
  test('alleen e-mail, lijst en de twee attributen: geen naam, geen IP-adres, geen nummer buiten BRON', async () => {
    await aanmelden([], ENV, 'bladmuziek:spiegel')
    assert.deepEqual(Object.keys(aanroepen[0].body).sort(), ['attributes', 'email', 'listIds'])
    assert.deepEqual(Object.keys(aanroepen[0].body.attributes).sort(), ['AANGEMELD_OP', 'BRON'])
  })
})
