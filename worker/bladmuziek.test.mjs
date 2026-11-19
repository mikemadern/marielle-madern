// Tests van de Worker voor bladmuziek. Alles is nagebootst: Resend, Turnstile, de R2-bucket en de limieten.
// Er gaat geen echte mail weg en er is geen sleutel nodig. Alle namen en adressen zijn verzonnen.
// Draaien: pnpm test:worker
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, test } from 'node:test'
import { behandel, geconfigureerd } from './bladmuziek.mjs'

const SITE = 'https://voorbeeld.example'
const HOSTNAME = 'voorbeeld.example'
const ACTIE = 'bladmuziek'
const LIJST = { 'hart-van-glas': { titel: 'Hart van glas' } }
const PDF = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10]) // "%PDF-1.4"
const GOED = {
  naam: 'Proefpersoon Verzonnen',
  email: 'test@example.org',
  nummer: 'hart-van-glas',
  token: 'proef',
  nieuwsbrief: false,
}

let gesprekken
let logregels
let origineel

// Een stukje nagebouwde omgeving met alles aan; een test zet er iets van uit
function maakOmgeving({ bestand = true, limiet = true, ipLimiet = true } = {}) {
  const limiter = (zet) => ({
    keys: [],
    async limit({ key }) {
      this.keys.push(key)
      return { success: zet }
    },
  })
  return {
    RESEND_API_KEY: 'proef-sleutel',
    TURNSTILE_SECRET: 'proef-geheim',
    BLADMUZIEK: {
      sleutels: [],
      async get(sleutel) {
        this.sleutels.push(sleutel)
        return bestand && sleutel === 'bladmuziek/hart-van-glas.pdf'
          ? { size: PDF.length, arrayBuffer: async () => PDF.buffer }
          : null
      },
    },
    LIMIET_IP: limiter(ipLimiet),
    LIMIET_ADRES: limiter(limiet),
    LIMIET_ALGEMEEN: limiter(true),
  }
}

// Nagebootste fetch: Turnstile en Resend, met instelbare uitkomsten
function maakFetch({
  turnstile = { success: true, hostname: HOSTNAME, action: ACTIE },
  resend = [200, 200],
} = {}) {
  let nummer = 0
  return async (url, init) => {
    gesprekken.push({ url: String(url), init })
    if (String(url).includes('turnstile')) return new Response(JSON.stringify(turnstile))
    const status = resend[nummer++] ?? 200
    return new Response(JSON.stringify({ id: 'proef' }), { status })
  }
}

const verzoek = (
  body,
  { methode = 'POST', pad = '/api/bladmuziek', origin = SITE, type = 'application/json' } = {},
) =>
  new Request(SITE + pad, {
    method: methode,
    headers: { origin, 'content-type': type },
    ...(methode === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  })

const run = (request, env = maakOmgeving(), fetchFn = maakFetch()) =>
  behandel(request, env, { lijst: LIJST, fetch: fetchFn })
const resendAanroepen = () => gesprekken.filter((g) => g.url.includes('resend'))
const json = async (res) => res.json()

beforeEach(() => {
  gesprekken = []
  logregels = []
  origineel = { log: console.log, error: console.error, warn: console.warn }
  for (const k of ['log', 'error', 'warn']) console[k] = (...a) => logregels.push(a.join(' '))
})
afterEach(() => Object.assign(console, origineel))

describe('routes en uitgeschakeld', () => {
  test('geen /api-verzoek: null (gaat naar de statische bestanden)', async () => {
    assert.equal(await run(verzoek(null, { methode: 'GET', pad: '/over-mij/' })), null)
  })
  test('onbekend /api-pad: 404', async () => {
    assert.equal((await run(verzoek({}, { pad: '/api/iets' }))).status, 404)
  })
  test('GET: 405', async () => {
    assert.equal((await run(verzoek(null, { methode: 'GET' }))).status, 405)
  })
  test('zonder secrets of bucket: 503 uitgeschakeld, en niets verzonden', async () => {
    for (const weg of [
      'RESEND_API_KEY',
      'TURNSTILE_SECRET',
      'BLADMUZIEK',
      'LIMIET_IP',
      'LIMIET_ADRES',
      'LIMIET_ALGEMEEN',
    ]) {
      const env = maakOmgeving()
      delete env[weg]
      assert.equal(geconfigureerd(env), false)
      const res = await run(verzoek(GOED), env)
      assert.equal(res.status, 503)
      assert.deepEqual(await json(res), { fout: 'uitgeschakeld' })
    }
    assert.equal(gesprekken.length, 0)
  })
  test('lege omgeving (zoals nu op Cloudflare): 503', async () => {
    assert.equal((await run(verzoek(GOED), {})).status, 503)
  })
})

describe('verzoek controleren', () => {
  test('andere herkomst of geen herkomst: 403', async () => {
    assert.equal((await run(verzoek(GOED, { origin: 'https://kwaad.example' }))).status, 403)
    const zonder = new Request(SITE + '/api/bladmuziek', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(GOED),
    })
    assert.equal((await run(zonder)).status, 403)
  })
  test('een body zonder content-length wordt gestreamd gelezen en stopt bij 4 KB: 413', async () => {
    let gelezen = 0
    const stroom = new ReadableStream({
      pull(controller) {
        gelezen++
        controller.enqueue(new TextEncoder().encode('x'.repeat(1024)))
      },
    })
    const request = new Request(SITE + '/api/bladmuziek', {
      method: 'POST',
      headers: { origin: SITE, 'content-type': 'application/json' },
      body: stroom,
      duplex: 'half',
    })
    assert.equal(request.headers.get('content-length'), null)
    const res = await run(request)
    assert.equal(res.status, 413)
    assert.ok(gelezen <= 8, `er is ${gelezen} keer gelezen uit een oneindige stroom`)
    assert.equal(gesprekken.length, 0)
  })
  test('geen JSON: 415', async () => {
    assert.equal((await run(verzoek('naam=x', { type: 'text/plain' }))).status, 415)
  })
  test('ongeldige JSON of te groot: 400 of 413', async () => {
    assert.equal((await run(verzoek('{kapot'))).status, 400)
    assert.equal(
      (await run(verzoek(JSON.stringify({ ...GOED, naam: 'x'.repeat(5000) })))).status,
      413,
    )
  })
  test('naam of adres leeg of ongeldig: 400 met het veld', async () => {
    const naam = await run(verzoek({ ...GOED, naam: '   ' }))
    assert.equal(naam.status, 400)
    assert.deepEqual(await json(naam), { fout: 'ongeldig', veld: 'naam' })
    for (const email of ['', 'geen-adres', 'a@b', 'a b@c.nl', 'a@b.nl,c@d.nl', '<x>@b.nl']) {
      const res = await run(verzoek({ ...GOED, email }))
      assert.equal(res.status, 400, email)
      assert.equal((await json(res)).veld, 'email')
    }
    assert.equal(gesprekken.length, 0)
  })
  test('onbekend nummer of een bestandsnaam van de bezoeker: 404, geen bucket-aanroep', async () => {
    const env = maakOmgeving()
    for (const nummer of [
      'bestaat-niet',
      '../geheim',
      'hart-van-glas.pdf',
      '__proto__',
      'constructor',
    ]) {
      const res = await run(verzoek({ ...GOED, nummer }), env)
      assert.equal(res.status, 404, nummer)
    }
    assert.deepEqual(env.BLADMUZIEK.sleutels, [])
    assert.equal(gesprekken.length, 0)
  })
})

describe('misbruik', () => {
  test('honeypot gevuld: 200, maar niets verzonden en niets gecontroleerd', async () => {
    const env = maakOmgeving()
    const res = await run(verzoek({ ...GOED, website: 'http://spam.example' }), env)
    assert.equal(res.status, 200)
    assert.equal(gesprekken.length, 0)
    assert.deepEqual(env.BLADMUZIEK.sleutels, [])
  })
  test('Turnstile mislukt: 400, geen mail, geen bucket', async () => {
    const env = maakOmgeving()
    const res = await run(verzoek(GOED), env, maakFetch({ turnstile: { success: false } }))
    assert.equal(res.status, 400)
    assert.equal((await json(res)).fout, 'controle_mislukt')
    assert.equal(resendAanroepen().length, 0)
    assert.deepEqual(env.BLADMUZIEK.sleutels, [])
  })
  test('token van een andere hostname (andere site): 400, geen mail, geen bucket', async () => {
    const env = maakOmgeving()
    const res = await run(
      verzoek(GOED),
      env,
      maakFetch({ turnstile: { success: true, hostname: 'aanvaller.example', action: ACTIE } }),
    )
    assert.equal(res.status, 400)
    assert.equal((await json(res)).fout, 'controle_mislukt')
    assert.equal(resendAanroepen().length, 0)
    assert.deepEqual(env.BLADMUZIEK.sleutels, [])
    assert.deepEqual(env.LIMIET_IP.keys, [])
  })
  test('hostname of actie ontbreekt of klopt niet in het antwoord van Turnstile: 400, geen mail', async () => {
    for (const turnstile of [
      { success: true },
      { success: true, action: ACTIE },
      { success: true, hostname: HOSTNAME },
      { success: true, hostname: HOSTNAME, action: 'iets-anders' },
      { success: true, hostname: 'www.' + HOSTNAME, action: ACTIE },
      { success: true, hostname: HOSTNAME.toUpperCase(), action: '' },
    ]) {
      const res = await run(verzoek(GOED), maakOmgeving(), maakFetch({ turnstile }))
      assert.equal(res.status, 400, JSON.stringify(turnstile))
    }
    assert.equal(resendAanroepen().length, 0)
  })
  test('hostname is die van het verzoek: ook een preview-adres werkt voor zichzelf', async () => {
    const preview = 'https://preview-pr-1-voorbeeld.example'
    const request = new Request(preview + '/api/bladmuziek', {
      method: 'POST',
      headers: { origin: preview, 'content-type': 'application/json' },
      body: JSON.stringify(GOED),
    })
    const goed = await run(
      request,
      maakOmgeving(),
      maakFetch({
        turnstile: { success: true, hostname: 'preview-pr-1-voorbeeld.example', action: ACTIE },
      }),
    )
    assert.equal(goed.status, 200)
  })
  test('Turnstile onbereikbaar: 503', async () => {
    const res = await run(verzoek(GOED), maakOmgeving(), async () => {
      throw new Error('netwerk')
    })
    assert.equal(res.status, 503)
  })
  test('limiet per adres bereikt: 429 met Retry-After, geen mail', async () => {
    const env = maakOmgeving({ limiet: false })
    const res = await run(verzoek(GOED), env)
    assert.equal(res.status, 429)
    assert.equal(res.headers.get('retry-after'), '60')
    assert.equal(resendAanroepen().length, 0)
  })
  test('limiet per IP-adres bereikt: 429 en de andere limieten tellen niet mee', async () => {
    const env = maakOmgeving({ ipLimiet: false })
    const res = await run(verzoek(GOED), env)
    assert.equal(res.status, 429)
    assert.deepEqual(env.LIMIET_ADRES.keys, [])
    assert.deepEqual(env.LIMIET_ALGEMEEN.keys, [])
    assert.equal(resendAanroepen().length, 0)
  })
  test('de IP-sleutel is een hash, hangt van het IP af en bevat het IP niet', async () => {
    const env = maakOmgeving()
    const metIp = (ip) =>
      new Request(SITE + '/api/bladmuziek', {
        method: 'POST',
        headers: { origin: SITE, 'content-type': 'application/json', 'cf-connecting-ip': ip },
        body: JSON.stringify(GOED),
      })
    await run(metIp('192.0.2.7'), env)
    await run(metIp('192.0.2.7'), env)
    await run(metIp('192.0.2.8'), env)
    const [a, b, c] = env.LIMIET_IP.keys
    assert.match(a, /^[0-9a-f]{64}$/)
    assert.equal(a, b)
    assert.notEqual(a, c)
    assert.ok(!a.includes('192') && !a.includes('.'))
  })
  test('de sleutel van de limiet is een hash, niet het adres', async () => {
    const env = maakOmgeving()
    await run(verzoek({ ...GOED, email: 'Test@Example.org' }), env)
    const sleutel = env.LIMIET_ADRES.keys[0]
    assert.match(sleutel, /^[0-9a-f]{64}$/)
    assert.ok(!sleutel.includes('@'))
    // hoofdletters tellen niet mee: hetzelfde adres geeft dezelfde sleutel
    await run(verzoek({ ...GOED, email: 'test@example.org' }), env)
    assert.equal(env.LIMIET_ADRES.keys[0], env.LIMIET_ADRES.keys[1])
  })
  test('geen bestand in de bucket: 404 en geen mail', async () => {
    const res = await run(verzoek(GOED), maakOmgeving({ bestand: false }))
    assert.equal(res.status, 404)
    assert.equal((await json(res)).fout, 'geen_bestand')
    assert.equal(resendAanroepen().length, 0)
  })
})

describe('versturen', () => {
  test('gelukt: één mail aan de bezoeker met de pdf als bijlage', async () => {
    const env = maakOmgeving()
    const res = await run(verzoek(GOED), env)
    assert.equal(res.status, 200)
    assert.deepEqual(await json(res), { ok: true, nieuwsbriefVerstuurd: false })
    assert.deepEqual(env.BLADMUZIEK.sleutels, ['bladmuziek/hart-van-glas.pdf'])
    const mails = resendAanroepen()
    assert.equal(mails.length, 1)
    assert.equal(mails[0].init.headers.authorization, 'Bearer proef-sleutel')
    const body = JSON.parse(mails[0].init.body)
    assert.equal(body.from, 'Mariëlle Madern <hallo@mariellemadern.nl>')
    assert.deepEqual(body.to, ['test@example.org'])
    assert.equal(body.subject, 'De bladmuziek van Hart van glas')
    assert.equal(body.attachments.length, 1)
    assert.equal(body.attachments[0].filename, 'bladmuziek-hart-van-glas.pdf')
    assert.equal(Buffer.from(body.attachments[0].content, 'base64').toString(), '%PDF-1.4\n')
    assert.match(body.text, /^Dag Proefpersoon Verzonnen,/)
  })
  test('Turnstile krijgt het geheim en het token, niet het adres van de bezoeker', async () => {
    await run(verzoek(GOED))
    const t = gesprekken.find((g) => g.url.includes('turnstile'))
    const velden = Object.fromEntries(t.init.body)
    assert.deepEqual(Object.keys(velden).sort(), ['response', 'secret'])
  })
  test('met nieuwsbrief: een tweede mail aan Mariëlle met naam en adres', async () => {
    const res = await run(verzoek({ ...GOED, nieuwsbrief: true }))
    assert.deepEqual(await json(res), { ok: true, nieuwsbriefVerstuurd: true })
    const mails = resendAanroepen().map((g) => JSON.parse(g.init.body))
    assert.equal(mails.length, 2)
    assert.deepEqual(mails[1].to, ['hallo@mariellemadern.nl'])
    assert.equal(mails[1].reply_to, 'test@example.org')
    assert.equal(mails[1].subject, 'Bladmuziek aangevraagd: Hart van glas')
    assert.match(mails[1].text, /Naam: Proefpersoon Verzonnen/)
    assert.match(mails[1].text, /Nieuwsbrief aangevinkt: ja/)
    assert.equal(mails[1].attachments, undefined)
  })
  test('nieuwsbrief aangevinkt maar de tweede mail mislukt: de bezoeker krijgt de bladmuziek wel', async () => {
    const res = await run(
      verzoek({ ...GOED, nieuwsbrief: true }),
      maakOmgeving(),
      maakFetch({ resend: [200, 500] }),
    )
    assert.deepEqual(await json(res), { ok: true, nieuwsbriefVerstuurd: false })
  })
  test('een naam met HTML wordt veilig gemaakt in de mail', async () => {
    await run(verzoek({ ...GOED, naam: '<b>Proef</b>\r\nBcc: x@example.org' }))
    const body = JSON.parse(resendAanroepen()[0].init.body)
    assert.ok(!body.html.includes('<b>Proef'))
    assert.match(body.html, /&lt;b&gt;Proef&lt;\/b&gt;/)
    assert.ok(!body.text.includes('\r'))
  })
  test('Resend: daglimiet of maandlimiet geeft 503, een andere fout 502', async () => {
    assert.equal(
      (await run(verzoek(GOED), maakOmgeving(), maakFetch({ resend: [429] }))).status,
      503,
    )
    assert.equal(
      (await run(verzoek(GOED), maakOmgeving(), maakFetch({ resend: [500] }))).status,
      502,
    )
  })
})

describe('privacy', () => {
  test('geen naam of adres in antwoorden of in wat de Worker logt', async () => {
    const naam = 'Proefpersoon Verzonnen'
    const email = 'test@example.org'
    const ip = '192.0.2.7'
    const antwoorden = []
    for (const body of [
      GOED,
      { ...GOED, nieuwsbrief: true },
      { ...GOED, email: 'kapot' },
      { ...GOED, nummer: 'bestaat-niet' },
    ]) {
      antwoorden.push(await (await run(verzoek(body))).text())
    }
    antwoorden.push(
      await (await run(verzoek(GOED), maakOmgeving(), maakFetch({ resend: [500] }))).text(),
    )
    antwoorden.push(await (await run(verzoek(GOED), maakOmgeving({ limiet: false }))).text())
    for (const tekst of [...antwoorden, ...logregels]) {
      assert.ok(!tekst.includes(naam) && !tekst.includes(email) && !tekst.includes(ip), tekst)
    }
    assert.deepEqual(logregels, [])
  })
  test('antwoorden zijn niet te bewaren en niet te indexeren', async () => {
    const res = await run(verzoek(GOED))
    assert.equal(res.headers.get('cache-control'), 'no-store')
    assert.equal(res.headers.get('x-robots-tag'), 'noindex')
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
  })
})
