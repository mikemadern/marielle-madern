// Controleert alle bestanden in content/ op ontbrekende of verkeerde velden.
// Nuxt Content doet dat zelf niet streng: een fout in het kopblok geeft anders stilletjes een kapotte pagina.
// Draait bij elke bouw (pnpm generate). Zie documenten/inhoud/contentmodel.md.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
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
  tekst(pad, d, 'kicker', { verplicht: false })
}

// Nummers
const nummers = []
const gebruikt = new Set()
for (const pad of bestandenIn('nummers', '.md')) {
  const { data: d, body } = kopblok(pad)
  const slug = basename(pad, '.md')
  nummers.push(slug)
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
  if (!body.includes('## Het verhaal achter het lied'))
    fout(pad, 'de kop "Het verhaal achter het lied" ontbreekt')
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
for (const slug of home.videolijst ?? [])
  if (!nummers.includes(slug)) fout(homePad, `videolijst: nummer ${slug} bestaat niet`)

// Uitgaven
for (const pad of bestandenIn('uitgaven', '.yml')) {
  let d = {}
  try {
    d = parse(readFileSync(join(wortel, pad), 'utf-8')) ?? {}
  } catch (e) {
    fout(pad, `geen geldige YAML (${e.message.split('\n')[0]})`)
  }
  bron(pad, d.cover, 'cover')
  for (const slug of d.nummers ?? [])
    if (!nummers.includes(slug)) fout(pad, `nummer ${slug} bestaat niet`)
  if (typeof d.cdPrijs !== 'number' || typeof d.verzendkosten !== 'number')
    fout(pad, 'cdPrijs en verzendkosten moeten getallen zijn')
}

if (fouten.length) {
  console.error(`Content: ${fouten.length} fout(en)\n` + fouten.map((f) => `  - ${f}`).join('\n'))
  process.exit(1)
}
console.log(`Content: alles in orde (${nummers.length} nummers).`)
