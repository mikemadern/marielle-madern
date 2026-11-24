// Tests van het eindpunt /api/contact. Alles is nagebootst: Resend, Turnstile en de limieten. Er gaat geen echte mail
// weg en er is geen sleutel nodig. Alle namen en adressen zijn verzonnen.
// Draaien: pnpm test:worker
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, test } from 'node:test'
import { behandel as behandelApi } from './api.mjs'
import { behandel as behandelBladmuziek } from './bladmuziek.mjs'
import { controleer, MAX_BERICHT } from './contact.mjs'
import {
  BEVESTIGING_MET_GEGEVENS,
  mailContactBevestiging,
  mailContactMarielle,
} from './teksten.mjs'

const SITE = 'https://mariellemadern.nl'
const HOSTNAME = 'mariellemadern.nl'
const LIJST = { 'hart-van-glas': { titel: 'Hart van glas' } }
const GOED = {
  naam: 'Proefpersoon Verzonnen',
  email: 'test@example.org',
  onderwerp: 'vraag',
  bericht: 'Een verzonnen vraag over een optreden.',
  token: 'proef',
}

let gesprekken
let logregels
let origineel

function maakOmgeving({ aan = true, limiet = true, ipLimiet = true, algemeen = true } = {}) {
  const limiter = (zet) => ({
    keys: [],
    async limit({ key }) {
      this.keys.push(key)
      return { success: zet }
    },
  })
  return {
    ...(aan ? { CONTACT_AAN: 'aan' } : {}),
    RESEND_API_KEY: 'proef-sleutel',
    TURNSTILE_SECRET: 'proef-geheim',
    LIMIET_CONTACT_IP: limiter(ipLimiet),
    LIMIET_CONTACT_ADRES: limiter(limiet),
    LIMIET_CONTACT_ALGEMEEN: limiter(algemeen),
    // de limieten en de bucket van de bladmuziek, om te laten zien dat ze los staan
    BLADMUZIEK: { get: async () => null },
    LIMIET_IP: limiter(true),
    LIMIET_ADRES: limiter(true),
    LIMIET_ALGEMEEN: limiter(true),
  }
}

function maakFetch({
  turnstile = { success: true, hostname: HOSTNAME, action: 'contact' },
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
  { methode = 'POST', host = HOSTNAME, origin, type = 'application/json' } = {},
) =>
  new Request(`https://${host}/api/contact`, {
    method: methode,
    headers: { origin: origin ?? `https://${host}`, 'content-type': type },
    ...(methode === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  })

const run = (request, env = maakOmgeving(), fetchFn = maakFetch(), extra = {}) =>
  behandelApi(request, env, { lijst: LIJST, fetch: fetchFn, ...extra })
const resend = () => gesprekken.filter((g) => g.url.includes('resend'))
const mailBody = (i) => JSON.parse(resend()[i].init.body)
const json = async (res) => res.json()

beforeEach(() => {
  gesprekken = []
  logregels = []
  origineel = { log: console.log, error: console.error, warn: console.warn }
  for (const k of ['log', 'error', 'warn']) console[k] = (...a) => logregels.push(a.join(' '))
})
afterEach(() => Object.assign(console, origineel))

describe('router en uitgeschakeld', () => {
  test('het contactpad gaat naar contact, het bladmuziekpad naar bladmuziek, een ander /api-pad geeft 404', async () => {
    const res = await run(verzoek(GOED))
    assert.equal(res.status, 200)
    const bm = await behandelApi(
      new Request(`${SITE}/api/bladmuziek`, { method: 'GET' }),
      maakOmgeving(),
      { lijst: LIJST, fetch: maakFetch() },
    )
    assert.equal(bm.status, 405)
    const onbekend = await run(new Request(`${SITE}/api/iets`, { method: 'POST' }))
    assert.equal(onbekend.status, 404)
    assert.equal(await run(new Request(`${SITE}/over-mij/`)), null)
    // dezelfde uitkomst als rechtstreeks bij bladmuziek
    const direct = await behandelBladmuziek(
      new Request(`${SITE}/api/iets`, { method: 'POST' }),
      maakOmgeving(),
      {
        lijst: LIJST,
        fetch: maakFetch(),
      },
    )
    assert.equal(direct.status, 404)
  })

  test('zonder CONTACT_AAN: 503 uitgeschakeld en niets verzonden', async () => {
    const res = await run(verzoek(GOED), maakOmgeving({ aan: false }))
    assert.equal(res.status, 503)
    assert.deepEqual(await json(res), { fout: 'uitgeschakeld' })
    assert.equal(gesprekken.length, 0)
  })

  test('CONTACT_AAN moet precies "aan" zijn; zonder secrets of limieten: 503', async () => {
    for (const env of [
      { ...maakOmgeving(), CONTACT_AAN: 'ja' },
      { ...maakOmgeving(), CONTACT_AAN: '' },
      { ...maakOmgeving(), RESEND_API_KEY: undefined },
      { ...maakOmgeving(), TURNSTILE_SECRET: undefined },
      { ...maakOmgeving(), LIMIET_CONTACT_ADRES: undefined },
    ]) {
      assert.equal((await run(verzoek(GOED), env)).status, 503)
    }
    assert.equal((await run(verzoek(GOED), {})).status, 503, 'lege omgeving')
  })

  test('de bladmuziek werkt via de router ook zonder de bindingen en variabele van het contactformulier', async () => {
    const limiter = {
      async limit() {
        return { success: true }
      },
    }
    const env = {
      RESEND_API_KEY: 'proef-sleutel',
      TURNSTILE_SECRET: 'proef-geheim',
      BLADMUZIEK: {
        get: async () => ({
          size: 9,
          arrayBuffer: async () => new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10]).buffer,
        }),
      },
      LIMIET_IP: limiter,
      LIMIET_ADRES: limiter,
      LIMIET_ALGEMEEN: limiter,
    }
    const res = await behandelApi(
      new Request(`${SITE}/api/bladmuziek`, {
        method: 'POST',
        headers: { origin: SITE, 'content-type': 'application/json' },
        body: JSON.stringify({
          naam: 'Proef',
          email: 'test@example.org',
          nummer: 'hart-van-glas',
          token: 'proef',
        }),
      }),
      env,
      {
        lijst: LIJST,
        fetch: maakFetch({
          turnstile: { success: true, hostname: HOSTNAME, action: 'bladmuziek' },
        }),
      },
    )
    assert.equal(res.status, 200)
    // ... en contact blijft dan uit (geen CONTACT_AAN, geen eigen limieten)
    assert.equal((await run(verzoek(GOED), env)).status, 503)
  })

  test('GET: 405; andere hostnaam (preview, workers.dev): 403 vóór de rest', async () => {
    assert.equal((await run(verzoek(null, { methode: 'GET' }))).status, 405)
    for (const host of [
      'preview-pr-1-mariellemadern.mmadern.workers.dev',
      'mariellemadern.mmadern.workers.dev',
    ]) {
      const res = await run(verzoek(GOED, { host }), maakOmgeving({ aan: false }))
      assert.equal(res.status, 403, host)
    }
    assert.equal(gesprekken.length, 0)
  })
})

describe('verzoek controleren', () => {
  test('andere herkomst: 403; geen JSON: 415; ongeldige JSON: 400; geen object: 400', async () => {
    assert.equal((await run(verzoek(GOED, { origin: 'https://andere.example' }))).status, 403)
    assert.equal((await run(verzoek(GOED, { type: 'text/plain' }))).status, 415)
    assert.equal((await run(verzoek('{kapot'))).status, 400)
    assert.equal((await run(verzoek('[1]'))).status, 400)
    assert.equal((await run(verzoek('null'))).status, 400)
  })

  test('te groot: 413 (24 KB), een bericht van 5000 tekens met speciale tekens past wel', async () => {
    const groot = await run(verzoek({ ...GOED, bericht: 'x'.repeat(30_000) }))
    assert.equal(groot.status, 413)
    const vol = await run(verzoek({ ...GOED, bericht: 'é€😀'.repeat(1666) + 'ab' })) // 5000 tekens, ruim 4 KB aan bytes
    assert.equal(vol.status, 200)
  })

  test('naam, adres, onderwerp en bericht: ongeldig geeft 400 met het veld', async () => {
    const gevallen = [
      [{ ...GOED, naam: '' }, 'naam'],
      [{ ...GOED, naam: 'x'.repeat(101) }, 'naam'],
      [{ ...GOED, email: 'kapot' }, 'email'],
      [{ ...GOED, email: 'a@b.nl\r\nBcc: x@y.nl' }, 'email'],
      [{ ...GOED, onderwerp: 'spam' }, 'onderwerp'],
      [{ ...GOED, onderwerp: undefined }, 'onderwerp'],
      [{ ...GOED, bericht: '   ' }, 'bericht'],
      [{ ...GOED, bericht: 'x'.repeat(MAX_BERICHT + 1) }, 'bericht'],
      [{ ...GOED, naam: 42 }, 'naam'],
    ]
    for (const [body, veld] of gevallen) {
      const res = await run(verzoek(body))
      assert.equal(res.status, 400, veld)
      assert.deepEqual(await json(res), { fout: 'ongeldig', veld })
    }
    assert.equal(gesprekken.length, 0, 'bij ongeldige invoer geen Turnstile en geen mail')
  })

  test('boekingsvelden: allemaal optioneel, gewone tekstvelden, alleen bij onderwerp boeking', () => {
    const boeking = { ...GOED, onderwerp: 'boeking' }
    assert.equal(controleer(boeking).fout, undefined)
    const alles = controleer({
      ...boeking,
      datumtijd: 'een zondag in maart, rond 10 uur',
      plaats: 'Verzonnen-stad',
      gelegenheid: 'Verzonnen feest',
      aantal: 'ongeveer 200',
      speeltijden: 'twee keer 30 minuten',
      budget: 'nog niet bekend',
    })
    assert.deepEqual(Object.keys(alles.boeking), [
      'datumtijd',
      'plaats',
      'gelegenheid',
      'aantal',
      'speeltijden',
      'budget',
    ])
    assert.equal(alles.boeking.aantal, 'ongeveer 200')
    // Een getal mag ook als getal binnenkomen, en lege velden vallen weg
    assert.equal(controleer({ ...boeking, aantal: 80, plaats: '  ' }).boeking.aantal, '80')
    assert.deepEqual(controleer({ ...boeking, plaats: '  ', datumtijd: '' }).boeking, {})
    // Boekingsvelden bij een ander onderwerp doen niet mee
    assert.deepEqual(controleer({ ...GOED, datumtijd: 'x', plaats: 'x' }).boeking, {})
    // Onbekende velden (de oude 'datum' en 'tijd') doen niet mee
    assert.deepEqual(controleer({ ...boeking, datum: '2027-01-01', tijd: '20:00' }).boeking, {})
    // Te lang of geen tekst
    for (const [veld, waarde] of [
      ['datumtijd', 'x'.repeat(101)],
      ['plaats', 'x'.repeat(101)],
      ['gelegenheid', 'x'.repeat(101)],
      ['aantal', 'x'.repeat(101)],
      ['speeltijden', 'x'.repeat(201)],
      ['budget', 'x'.repeat(101)],
      ['plaats', { a: 1 }],
    ]) {
      assert.equal(controleer({ ...boeking, [veld]: waarde }).veld, veld, veld)
    }
    // precies op de grens mag
    assert.equal(
      controleer({ ...boeking, speeltijden: 'x'.repeat(200), plaats: 'x'.repeat(100) }).fout,
      undefined,
    )
  })

  test('het onderwerp is Algemene vraag of Boeking; andere waarden worden geweigerd', () => {
    assert.equal(controleer({ ...GOED, onderwerp: 'vraag' }).fout, undefined)
    assert.equal(controleer({ ...GOED, onderwerp: 'boeking' }).fout, undefined)
    for (const onderwerp of ['samenwerking', 'anders', 'Boeking', '', 'constructor', '__proto__']) {
      assert.equal(controleer({ ...GOED, onderwerp }).veld, 'onderwerp', onderwerp)
    }
  })

  test('stuurtekens en regeleinden in naam en velden worden schoon; het bericht houdt zijn regeleinden', () => {
    const r = controleer({
      ...GOED,
      naam: '  Jan\r\nBcc: x@y.nl\u0000  Jansen ',
      bericht: 'regel een\r\nregel twee\u0007\n\nregel vier',
      onderwerp: 'boeking',
      plaats: 'Stad\nBcc: x',
    })
    assert.equal(r.naam, 'Jan Bcc: x@y.nl Jansen')
    assert.equal(r.bericht, 'regel een\nregel twee \n\nregel vier')
    assert.equal(r.boeking.plaats, 'Stad Bcc: x')
  })
})

describe('misbruik', () => {
  test('honeypot gevuld: 200, maar niets verzonden en niets gecontroleerd', async () => {
    const res = await run(verzoek({ ...GOED, website: 'http://spam.example' }))
    assert.equal(res.status, 200)
    assert.deepEqual(await json(res), { ok: true })
    assert.equal(gesprekken.length, 0)
  })

  test('Turnstile mislukt, ander hostname of een token van een andere actie (bladmuziek): 400 en geen mail', async () => {
    for (const turnstile of [
      { success: false },
      { success: true, hostname: 'andere.example', action: 'contact' },
      { success: true, hostname: HOSTNAME, action: 'bladmuziek' },
      { success: true, hostname: HOSTNAME },
      { success: true, action: 'contact' },
    ]) {
      gesprekken = []
      const res = await run(verzoek(GOED), maakOmgeving(), maakFetch({ turnstile }))
      assert.equal(res.status, 400, JSON.stringify(turnstile))
      assert.deepEqual(await json(res), { fout: 'controle_mislukt' })
      assert.equal(resend().length, 0)
    }
  })

  test('Turnstile onbereikbaar: 503; Turnstile krijgt het geheim en het token, niet het adres', async () => {
    const stuk = async () => {
      throw new Error('netwerk')
    }
    assert.equal((await run(verzoek(GOED), maakOmgeving(), stuk)).status, 503)
    await run(verzoek(GOED))
    const t = gesprekken.find((g) => g.url.includes('turnstile'))
    const params = new URLSearchParams(String(t.init.body))
    assert.deepEqual([...params.keys()].sort(), ['response', 'secret'])
  })

  test('limieten: per adres, per IP-adres en algemeen geven 429 met Retry-After en geen mail; ze zijn los van de bladmuziek', async () => {
    for (const opties of [{ limiet: false }, { ipLimiet: false }, { algemeen: false }]) {
      gesprekken = []
      const res = await run(verzoek(GOED), maakOmgeving(opties))
      assert.equal(res.status, 429, JSON.stringify(opties))
      assert.equal(res.headers.get('retry-after'), '60')
      assert.equal(resend().length, 0)
    }
    // een geblokkeerd verzoek telt niet mee voor de volgende limiet (vroege stop)
    const env = maakOmgeving({ ipLimiet: false })
    await run(verzoek(GOED), env)
    assert.equal(env.LIMIET_CONTACT_ADRES.keys.length, 0)
    // de limieten van de bladmuziek worden niet aangeraakt en andersom
    const env2 = maakOmgeving()
    await run(verzoek(GOED), env2)
    assert.equal(
      env2.LIMIET_IP.keys.length + env2.LIMIET_ADRES.keys.length + env2.LIMIET_ALGEMEEN.keys.length,
      0,
    )
    assert.equal(env2.LIMIET_CONTACT_IP.keys.length, 1)
  })

  test('de limietsleutels zijn hashes: noch het adres noch het IP-adres staat erin, en contact en bladmuziek delen geen sleutel', async () => {
    const env = maakOmgeving()
    const req = new Request(`${SITE}/api/contact`, {
      method: 'POST',
      headers: {
        origin: SITE,
        'content-type': 'application/json',
        'cf-connecting-ip': '192.0.2.7',
      },
      body: JSON.stringify(GOED),
    })
    await run(req, env)
    const sleutels = [
      ...env.LIMIET_CONTACT_IP.keys,
      ...env.LIMIET_CONTACT_ADRES.keys,
      ...env.LIMIET_CONTACT_ALGEMEEN.keys,
    ]
    assert.equal(sleutels.length, 3)
    for (const s of sleutels)
      assert.ok(!s.includes('192.0.2.7') && !s.includes('test@example.org'), s)
    assert.match(env.LIMIET_CONTACT_IP.keys[0], /^[0-9a-f]{64}$/)
    assert.match(env.LIMIET_CONTACT_ADRES.keys[0], /^[0-9a-f]{64}$/)
    assert.equal(env.LIMIET_CONTACT_ALGEMEEN.keys[0], 'algemeen')
  })
})

describe('versturen', () => {
  test('gelukt: eerst de mail aan Mariëlle (reply_to is de bezoeker), dan de bevestiging aan de bezoeker', async () => {
    const res = await run(verzoek({ ...GOED, bericht: 'Regel een\nRegel twee' }))
    assert.equal(res.status, 200)
    assert.deepEqual(await json(res), { ok: true, bevestigingVerstuurd: true })
    assert.equal(resend().length, 2)
    const een = mailBody(0)
    assert.equal(een.from, 'Mariëlle Madern <hallo@mariellemadern.nl>')
    assert.deepEqual(een.to, ['hallo@mariellemadern.nl'])
    assert.equal(een.reply_to, 'test@example.org')
    assert.equal(een.subject, 'Vraag van Proefpersoon Verzonnen')
    assert.equal(
      een.text,
      [
        'Onderwerp: Algemene vraag',
        'Naam: Proefpersoon Verzonnen',
        'E-mailadres: test@example.org',
        '',
        'Bericht:',
        'Regel een\nRegel twee',
      ].join('\n'),
    )
    const twee = mailBody(1)
    assert.deepEqual(twee.to, ['test@example.org'])
    assert.equal(twee.reply_to, undefined)
    assert.equal(twee.subject, 'Ik heb je bericht ontvangen')
  })

  test('een boeking: de zes velden staan in de mail aan Mariëlle, het onderwerp noemt plaats of datum', async () => {
    const velden = {
      datumtijd: 'een zondag in maart',
      plaats: 'Verzonnen-stad',
      gelegenheid: 'kerkdienst',
      aantal: 'ongeveer 200',
      speeltijden: 'start om 10 uur, een uur',
      budget: 'nog niet bekend',
    }
    assert.equal((await run(verzoek({ ...GOED, onderwerp: 'boeking', ...velden }))).status, 200)
    const mail = mailBody(0)
    assert.equal(mail.subject, 'Boeking: Verzonnen-stad van Proefpersoon Verzonnen')
    assert.equal(
      mail.text,
      [
        'Onderwerp: Boeking',
        'Naam: Proefpersoon Verzonnen',
        'E-mailadres: test@example.org',
        '',
        'Datum en tijd: een zondag in maart',
        'Plaats: Verzonnen-stad',
        'Soort gelegenheid: kerkdienst',
        'Verwacht aantal bezoekers: ongeveer 200',
        'Speeltijden en duur: start om 10 uur, een uur',
        'Budget: nog niet bekend',
        '',
        'Bericht:',
        GOED.bericht,
      ].join('\n'),
    )
    // Zonder plaats: de datum; zonder allebei een vaste zin; lege velden blijven als regel staan
    const zonderPlaats = mailContactMarielle({
      naam: 'Jan',
      email: 'a@b.nl',
      onderwerp: 'boeking',
      bericht: 'x',
      boeking: { datumtijd: 'maart' },
    })
    assert.equal(zonderPlaats.subject, 'Boeking: maart van Jan')
    assert.match(zonderPlaats.text, /Plaats:\n/)
    const leeg = mailContactMarielle({
      naam: 'Jan',
      email: 'a@b.nl',
      onderwerp: 'boeking',
      bericht: 'x',
      boeking: {},
    })
    assert.equal(leeg.subject, 'Boeking: zonder plaats of datum van Jan')
  })

  test('de bevestiging is standaard ALLEEN vaste tekst: niets van wat de bezoeker intikte', async () => {
    assert.equal(BEVESTIGING_MET_GEGEVENS, false)
    const naam = 'Verzonnen Naam <b>x</b>'
    const bericht = 'Klik op https://kwaad.example/inloggen en bel 0612345678'
    await run(
      verzoek({
        ...GOED,
        naam,
        bericht,
        onderwerp: 'boeking',
        plaats: 'Plaatsnaam-XYZ',
        budget: 'veel-geld',
      }),
    )
    const bevestiging = mailBody(1)
    const alles = JSON.stringify(bevestiging)
    for (const verboden of [
      'Verzonnen Naam',
      'kwaad.example',
      '0612345678',
      'inloggen',
      '<b>',
      'Plaatsnaam-XYZ',
      'veel-geld',
    ]) {
      assert.ok(!alles.includes(verboden), verboden)
    }
    assert.doesNotMatch(bevestiging.text, /https?:\/\//)
    // Wel de vaste tekst van de Tekstschrijver, het onderwerp uit de vaste lijst en een vaste afzender
    assert.match(
      bevestiging.text,
      /^Dag,\n\nDank je voor je bericht\. Het is bij mij aangekomen, en ik reageer zo snel ik kan\./,
    )
    assert.match(bevestiging.text, /Onderwerp: Boeking/)
    assert.match(bevestiging.text, /Hartelijke groet,\n\nMariëlle Madern$/)
    assert.equal(bevestiging.from, 'Mariëlle Madern <hallo@mariellemadern.nl>')
    assert.deepEqual(Object.keys(bevestiging).sort(), ['from', 'html', 'subject', 'text', 'to'])
  })

  test('de bevestiging met gegevens (de tekst van de Tekstschrijver, als de eigenaar dat kiest): naam, boeking en bericht, veilig gemaakt', () => {
    const v = {
      naam: 'Jan <b>Jansen</b>',
      onderwerp: 'boeking',
      bericht: 'Regel een <i>twee</i>\nregel drie',
      boeking: { plaats: 'Verzonnen-stad', budget: 'nog niet bekend' },
    }
    const m = mailContactBevestiging(v, true)
    assert.equal(m.subject, 'Ik heb je bericht ontvangen')
    assert.match(m.text, /^Dag Jan <b>Jansen<\/b>,\n\nDank je voor je bericht\./)
    assert.match(
      m.text,
      /Dit heb je gestuurd:\n\nOnderwerp: Boeking\nPlaats: Verzonnen-stad\nBudget: nog niet bekend\nJe bericht: Regel een <i>twee<\/i>\nregel drie/,
    )
    // lege boekingsvelden worden weggelaten
    assert.doesNotMatch(m.text, /Datum en tijd|Soort gelegenheid|Speeltijden/)
    // in de HTML is alles veilig gemaakt
    assert.ok(!m.html.includes('<b>') && !m.html.includes('<i>'))
    assert.match(m.html, /Dag Jan &lt;b&gt;Jansen&lt;\/b&gt;,/)
    assert.match(m.html, /Je bericht: Regel een &lt;i&gt;twee&lt;\/i&gt;<br>regel drie/)
    // een algemene vraag toont geen boekingsvelden, ook niet als ze zijn meegestuurd
    const vraag = mailContactBevestiging({ ...v, onderwerp: 'vraag' }, true)
    assert.doesNotMatch(vraag.text, /Plaats|Budget/)
    assert.match(vraag.text, /Onderwerp: Algemene vraag/)
  })

  test('HTML in naam en bericht wordt veilig gemaakt; het onderwerp bevat geen regeleinden en maximaal 60 tekens naam', async () => {
    await run(
      verzoek({
        ...GOED,
        naam: '<script>alert(1)</script>' + 'x'.repeat(100).slice(0, 70),
        bericht: '<img src=x onerror=alert(1)> "aanhalingstekens" & \'apostrof\'\nregel twee',
      }),
    )
    const mail = mailBody(0)
    assert.ok(!mail.html.includes('<script>') && !mail.html.includes('<img'))
    assert.match(mail.html, /&lt;script&gt;/)
    assert.match(mail.html, /&lt;img src=x onerror=alert\(1\)&gt;/)
    assert.match(mail.html, /&quot;aanhalingstekens&quot; &amp; &#39;apostrof&#39;<br>regel twee/)
    assert.ok(!/[\r\n]/.test(mail.subject))
    const naamInOnderwerp = mail.subject.replace(/^Vraag van /, '')
    assert.ok([...naamInOnderwerp].length <= 60, naamInOnderwerp.length)
  })

  test('header-injectie: regeleinden in naam of onderwerp komen niet in het onderwerp of de aanvullende kopregels', async () => {
    await run(verzoek({ ...GOED, naam: 'Jan\r\nBcc: kwaad@example.org\r\nSubject: x' }))
    const mail = mailBody(0)
    assert.ok(!/[\r\n]/.test(mail.subject), mail.subject)
    assert.equal(mail.bcc, undefined)
    assert.deepEqual(Object.keys(mail).sort(), [
      'from',
      'html',
      'reply_to',
      'subject',
      'text',
      'to',
    ])
    assert.equal(mail.reply_to, 'test@example.org')
  })

  test('de bevestiging mislukt: het bericht is toch aangekomen (200 met bevestigingVerstuurd false)', async () => {
    const res = await run(verzoek(GOED), maakOmgeving(), maakFetch({ resend: [200, 500] }))
    assert.equal(res.status, 200)
    assert.deepEqual(await json(res), { ok: true, bevestigingVerstuurd: false })
    const stuk = await run(verzoek(GOED), maakOmgeving(), maakFetch({ resend: [200, 429] }))
    assert.deepEqual(await json(stuk), { ok: true, bevestigingVerstuurd: false })
  })

  test('de mail aan Mariëlle mislukt: 502, of 503 bij de daglimiet van Resend; dan geen bevestiging', async () => {
    gesprekken = []
    const stuk = await run(verzoek(GOED), maakOmgeving(), maakFetch({ resend: [500] }))
    assert.equal(stuk.status, 502)
    assert.equal(resend().length, 1)
    gesprekken = []
    const vol = await run(verzoek(GOED), maakOmgeving(), maakFetch({ resend: [429] }))
    assert.equal(vol.status, 503)
    assert.deepEqual(await json(vol), { fout: 'tijdelijk_niet_beschikbaar' })
    assert.equal(resend().length, 1)
  })
})

describe('privacy', () => {
  test('geen naam, adres of bericht in antwoorden of in wat de Worker logt, en nooit iets in de URL', async () => {
    const naam = 'Proefpersoon Verzonnen'
    const email = 'test@example.org'
    const bericht = 'Een verzonnen vraag over een optreden.'
    const ip = '192.0.2.7'
    const antwoorden = []
    for (const [body, env, fetchFn] of [
      [GOED, maakOmgeving(), maakFetch()],
      [{ ...GOED, email: 'kapot' }, maakOmgeving(), maakFetch()],
      [GOED, maakOmgeving(), maakFetch({ resend: [500] })],
      [GOED, maakOmgeving(), maakFetch({ resend: [200, 500] })],
      [GOED, maakOmgeving({ limiet: false }), maakFetch()],
      [GOED, maakOmgeving({ aan: false }), maakFetch()],
    ]) {
      antwoorden.push(await (await run(verzoek(body), env, fetchFn)).text())
    }
    for (const tekst of [...antwoorden, ...logregels]) {
      assert.ok(![naam, email, bericht, ip].some((x) => tekst.includes(x)), tekst)
    }
    assert.deepEqual(logregels, [])
    // De gegevens gaan in de body, niet in de URL
    for (const g of gesprekken)
      assert.ok(!g.url.includes(email) && !g.url.includes('Proefpersoon'), g.url)
  })

  test('antwoorden zijn niet te bewaren en niet te indexeren', async () => {
    const res = await run(verzoek(GOED))
    assert.equal(res.headers.get('cache-control'), 'no-store')
    assert.equal(res.headers.get('x-robots-tag'), 'noindex')
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
  })
})
