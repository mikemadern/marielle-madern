// Controleert alle bestanden in content/ op ontbrekende of verkeerde velden.
// Nuxt Content doet dat zelf niet streng: een fout in het kopblok geeft anders stilletjes een kapotte pagina.
// Draait bij elke bouw (pnpm generate). Zie documenten/inhoud/contentmodel.md.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const wortel = fileURLToPath(new URL('..', import.meta.url))
const fouten = []
const fout = (bestand, tekst) => fouten.push(`${bestand}: ${tekst}`)

const bestandenIn = (map, ext) =>
  readdirSync(join(wortel, 'content', map))
    .filter((f) => f.endsWith(ext))
    .map((f) => join('content', map, f))

function kopblok(pad) {
  const tekst = readFileSync(join(wortel, pad), 'utf-8')
  const m = tekst.match(/^---\n([\s\S]*?)\n---\n/)
  if (!m) {
    fout(pad, 'geen kopblok tussen --- regels')
    return { data: {}, body: tekst }
  }
  try {
    return { data: parse(m[1]) ?? {}, body: tekst.slice(m[0].length) }
  } catch (e) {
    fout(pad, `kopblok is geen geldige YAML (${e.message.split('\n')[0]})`)
    return { data: {}, body: '' }
  }
}

const tekst = (pad, d, veld, { min, max, verplicht = true } = {}) => {
  const v = d[veld]
  if (v === undefined || v === null) return verplicht && fout(pad, `${veld} ontbreekt`)
  if (typeof v !== 'string')
    return fout(pad, `${veld} is geen tekst (staat er een dubbele punt zonder aanhalingstekens?)`)
  if (min && v.length < min) fout(pad, `${veld} is ${v.length} tekens, minimaal ${min}`)
  if (max && v.length > max) fout(pad, `${veld} is ${v.length} tekens, maximaal ${max}`)
}

const bron = (pad, src, veld) => {
  const kaal = String(src ?? '').replace(/\.[^./]+$/, '')
  const gevonden = ['webp', 'jpg', 'jpeg', 'png'].some((e) =>
    existsSync(join(wortel, 'app', 'bronafbeeldingen', `${kaal}.${e}`)),
  )
  if (!gevonden) fout(pad, `${veld}: bronafbeelding ${src} staat niet in app/bronafbeeldingen`)
}

// Pagina's
for (const pad of bestandenIn('paginas', '.md')) {
  const { data: d } = kopblok(pad)
  tekst(pad, d, 'title')
  tekst(pad, d, 'description', { min: 70, max: 160 })
  tekst(pad, d, 'seoTitel', { max: 60, verplicht: false })
  if (!['sage', 'lichtgoud', 'blush'].includes(d.kleur))
    fout(pad, 'kleur moet sage, lichtgoud of blush zijn')
  tekst(pad, d, 'accent')
  tekst(pad, d, 'kop', { verplicht: false })
  tekst(pad, d, 'bannerTitel', { verplicht: false })
  // Over de muziek: de teksten van het EP-deel en het singles-deel
  if (basename(pad, '.md') === 'over-de-muziek') {
    for (const veld of ['epAccent', 'epRegel', 'singlesAccent', 'singlesKop', 'singlesRegel'])
      tekst(pad, d, veld)
    if (!d.epKnop?.tekst || !d.epKnop?.link) fout(pad, 'epKnop heeft tekst en link nodig')
  }
}

// De nummers van de EP staan in content/uitgaven; een nummer met uitgave: ep moet daar staan, anders
// verdwijnt het van Over de muziek
const epNummers = new Set()
for (const pad of bestandenIn('uitgaven', '.yml')) {
  try {
    for (const slug of parse(readFileSync(join(wortel, pad), 'utf-8'))?.nummers ?? [])
      epNummers.add(slug)
  } catch {
    // een fout in het bestand zelf meldt de controle van de uitgaven hieronder
  }
}

// Nummers
const nummers = []
const uitgaveVan = {}
const gebruikt = new Set()
for (const pad of bestandenIn('nummers', '.md')) {
  const { data: d, body } = kopblok(pad)
  const slug = basename(pad, '.md')
  nummers.push(slug)
  uitgaveVan[slug] = d.uitgave
  if (d.uitgave === 'ep' && !epNummers.has(slug))
    fout(pad, 'uitgave is ep, maar het nummer staat niet in content/uitgaven')
  tekst(pad, d, 'title')
  tekst(pad, d, 'description', { min: 70, max: 160 })
  if (!['ep', 'single'].includes(d.uitgave)) fout(pad, 'uitgave moet ep of single zijn')
  if (!Number.isInteger(d.volgorde) || d.volgorde < 1)
    fout(pad, 'volgorde moet een heel getal vanaf 1 zijn')
  const sleutel = `${d.uitgave}-${d.volgorde}`
  if (gebruikt.has(sleutel)) fout(pad, `volgorde ${d.volgorde} is al in gebruik bij ${d.uitgave}`)
  gebruikt.add(sleutel)
  if (!/^\d{1,2}:\d{2}$/.test(String(d.duur ?? '')))
    fout(pad, 'duur moet m:ss zijn, bijvoorbeeld "3:47" (tussen aanhalingstekens)')
  tekst(pad, d, 'kaartregel', { min: 10, max: 90 })
  if (d.appleMusic !== undefined && !String(d.appleMusic).startsWith('https://music.apple.com/'))
    fout(pad, 'appleMusic moet een volledige link zijn die met https://music.apple.com/ begint')
  if (!d.cover?.src || !d.cover?.alt) fout(pad, 'cover heeft src en alt nodig')
  else bron(pad, d.cover.src, 'cover')
  if (!d.videoBeeld) fout(pad, 'videoBeeld ontbreekt')
  else bron(pad, d.videoBeeld, 'videoBeeld')
  if (!/^[\w-]{11}$/.test(String(d.youtube ?? '')))
    fout(pad, 'youtube moet de video-ID van 11 tekens zijn')
  if (!/^[A-Za-z0-9]{22}$/.test(String(d.spotify ?? '')))
    fout(pad, 'spotify moet de track-ID van 22 tekens zijn')
  if (d.origineel && (!d.origineel.titel || !d.origineel.artiest))
    fout(pad, 'origineel heeft titel en artiest nodig')
  if (typeof d.liedtekst !== 'string' || d.liedtekst.trim().length < 20)
    fout(pad, 'liedtekst ontbreekt of is erg kort')
  if (typeof d.verhaal !== 'string' || d.verhaal.trim().length < 20)
    fout(pad, 'verhaal ontbreekt of is erg kort')
  if (typeof d.bijzonder !== 'string' || d.bijzonder.trim().length < 20)
    fout(pad, 'bijzonder (wat dit nummer zo bijzonder maakt) ontbreekt')
  if (body.trim())
    fout(pad, 'de tekst staat in de velden van het kopblok, de body hoort leeg te zijn')
}

// Homepage
const homePad = 'content/home.yml'
let home = {}
try {
  home = parse(readFileSync(join(wortel, homePad), 'utf-8')) ?? {}
} catch (e) {
  fout(homePad, `geen geldige YAML (${e.message.split('\n')[0]})`)
}
tekst(homePad, home, 'seoTitel', { max: 60 })
tekst(homePad, home, 'description', { min: 70, max: 160 })
if (!Array.isArray(home.heroRegels) || !home.heroRegels.length)
  fout(homePad, 'heroRegels ontbreekt')
for (const slug of home.voetlijst ?? [])
  if (!nummers.includes(slug)) fout(homePad, `voetlijst: nummer ${slug} bestaat niet`)
for (const slug of home.videolijst ?? [])
  if (!nummers.includes(slug)) fout(homePad, `videolijst: nummer ${slug} bestaat niet`)
if (!nummers.includes(home.uitgelicht))
  fout(homePad, `uitgelicht: nummer ${home.uitgelicht} bestaat niet`)
else if (!(home.videolijst ?? []).includes(home.uitgelicht))
  fout(homePad, `uitgelicht: nummer ${home.uitgelicht} staat niet in de videolijst`)
for (const veld of [
  'uitgelichtRegel',
  'spelerNoot',
  'luisterSpotify',
  'luisterAppleMusic',
  'luisterYoutube',
  'verhaalKnop',
  'afspeelKnop',
  'duurWoord',
  'epAccent',
  'epRegel',
  'epPrijs',
  'epCoverAlt',
  'contactKop',
  'contactRegel',
])
  tekst(homePad, home, veld)
if (typeof home.epPrijs === 'string' && !home.epPrijs.includes('{prijs}'))
  fout(homePad, 'epPrijs moet {prijs} bevatten (daar komt het bedrag uit de uitgave)')
for (const veld of ['epKnop', 'contactKnop'])
  if (!home[veld]?.tekst || !home[veld]?.link) fout(homePad, `${veld} heeft tekst en link nodig`)

// Toegestane lijst voor de deelafbeeldingen: elk genoemd nummer moet bestaan
const deelPad = 'app/data/deelafbeeldingen.json'
try {
  const deel = JSON.parse(readFileSync(join(wortel, deelPad), 'utf-8'))
  if (!Array.isArray(deel.hoezen)) fout(deelPad, 'hoezen moet een lijst zijn')
  for (const slug of deel.hoezen ?? [])
    if (!nummers.includes(slug)) fout(deelPad, `hoezen: nummer ${slug} bestaat niet`)
  if (typeof deel.epHoes !== 'boolean') fout(deelPad, 'epHoes moet true of false zijn')
} catch (e) {
  fout(deelPad, `ontbreekt of is geen geldige JSON (${e.message.split('\n')[0]})`)
}

// Uitgaven
for (const pad of bestandenIn('uitgaven', '.yml')) {
  let d = {}
  try {
    d = parse(readFileSync(join(wortel, pad), 'utf-8')) ?? {}
  } catch (e) {
    fout(pad, `geen geldige YAML (${e.message.split('\n')[0]})`)
  }
  bron(pad, d.cover, 'cover')
  for (const slug of d.nummers ?? []) {
    if (!nummers.includes(slug)) fout(pad, `nummer ${slug} bestaat niet`)
    else if (uitgaveVan[slug] !== 'ep')
      fout(
        pad,
        `nummer ${slug} staat bij de EP, maar heeft in zijn eigen bestand uitgave: ${uitgaveVan[slug]}`,
      )
  }
  if (typeof d.cdPrijs !== 'number' || typeof d.verzendkosten !== 'number')
    fout(pad, 'cdPrijs en verzendkosten moeten getallen zijn')
}

// Geen lang gedachtestreepje (em dash) in de tekst van de site: niet het teken zelf, niet &mdash;,
// &#8212; of &#x2014; en niet als \u2014. Gebruik een komma, punt, dubbele punt of haakjes, en
// ' | ' tussen delen van een titel. Het korte streepje (en dash) en het koppelteken mogen wel.
const EM_DASH = /\u2014|&mdash;|&#8212;|&#x2014;|\\u2014/i
const TEKST_BESTAND =
  /\.(md|vue|ts|mjs|js|json|ya?ml|svg|txt|html|css|xml)$|(^|\/)_(headers|redirects)$/
function zoekEmDash(map) {
  for (const naam of readdirSync(join(wortel, map))) {
    const pad = `${map}/${naam}`
    if (statSync(join(wortel, pad)).isDirectory()) zoekEmDash(pad)
    else if (TEKST_BESTAND.test(pad)) {
      readFileSync(join(wortel, pad), 'utf-8')
        .split('\n')
        .forEach((regel, i) => {
          if (EM_DASH.test(regel))
            fout(
              `${pad}:${i + 1}`,
              'lang gedachtestreepje (em dash), gebruik een komma, punt, dubbele punt of haakjes',
            )
        })
    }
  }
}
for (const map of ['app', 'content', 'public']) if (existsSync(join(wortel, map))) zoekEmDash(map)

if (fouten.length) {
  console.error(`Content: ${fouten.length} fout(en)\n` + fouten.map((f) => `  - ${f}`).join('\n'))
  process.exit(1)
}
console.log(`Content: alles in orde (${nummers.length} nummers).`)
