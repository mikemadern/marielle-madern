// Gegevens voor de deelafbeeldingen (og:image en twitter:image, 1200 x 630): welke afbeeldingen er zijn,
// wat erop staat en waar de invoer van de hash uit bestaat. Eén bron voor scripts/og/maak.mjs (maakt de
// afbeeldingen) en scripts/og/check.mjs (controleert ze in de bouw, zonder satori of sharp).
// Opmaak: Designer, design/deelafbeeldingen.md (sjabloon met kleurvlak, crème paneel, logo, blaadje en titel).
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

export const ROOT = fileURLToPath(new URL('../..', import.meta.url))
export const OUT_DIR = join(ROOT, 'public', 'afbeeldingen', 'og')
export const MANIFEST = join(OUT_DIR, 'manifest.json')
export const WIDTH = 1200
export const HEIGHT = 630
export const MAX_BYTES = 150_000

// Verander je iets aan de opmaak in maak.mjs, verhoog dit getal: dan klopt geen enkele hash meer en maakt
// pnpm og alles opnieuw.
export const SJABLOON_VERSIE = 1

export const KLEUREN = { sage: '#acb897', lichtgoud: '#e3d49b', blush: '#f2d5cd' }
export const TEKST = '#41423c'
export const CREME = '#faf5ef'

export const BESTANDEN = {
  logo: join(ROOT, 'public', 'logo', 'mariellemadern-logo-donker.svg'),
  blad: join(ROOT, 'public', 'illustraties', 'blad.svg'),
  takken: join(ROOT, 'scripts', 'og', 'illustratie-takken.svg'),
  fontLatin: join(
    ROOT,
    'node_modules',
    '@fontsource',
    'mukta',
    'files',
    'mukta-latin-400-normal.woff',
  ),
  fontExt: join(
    ROOT,
    'node_modules',
    '@fontsource',
    'mukta',
    'files',
    'mukta-latin-ext-400-normal.woff',
  ),
}

export const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

// Grootte van de titel, volgens het aantal tekens (spaties tellen mee) en de variant
export function titelGrootte(tekens, variant) {
  if (variant === 'pagina') return tekens <= 16 ? 68 : tekens <= 19 ? 58 : 50
  return tekens <= 19 ? 58 : 50
}

const kopblok = (pad) => {
  const m = readFileSync(pad, 'utf-8').match(/^---\n([\s\S]*?)\n---/)
  return parse(m?.[1] ?? '') ?? {}
}

const zoekBron = (src) => {
  const kaal = String(src)
    .replace(/^\//, '')
    .replace(/\.[^./]+$/, '')
  for (const ext of ['webp', 'jpg', 'jpeg', 'png']) {
    const pad = join(ROOT, 'app', 'bronafbeeldingen', `${kaal}.${ext}`)
    if (existsSync(pad)) return pad
  }
  throw new Error(`Bronafbeelding ${src} staat niet in app/bronafbeeldingen`)
}

// Alle afbeeldingen: de home, elke pagina in content/paginas en elk nummer in content/nummers.
// Een nieuwe pagina of een nieuw nummer komt dus vanzelf mee (een nummer krijgt zijn hoes pas als het op de
// toegestane lijst staat, anders het logo).
export function laadItems() {
  const toegestaan = JSON.parse(
    readFileSync(join(ROOT, 'scripts', 'deelafbeeldingen-toegestaan.json'), 'utf-8'),
  )
  const home = parse(readFileSync(join(ROOT, 'content', 'home.yml'), 'utf-8')) ?? {}
  const uitgave = readdirSync(join(ROOT, 'content', 'uitgaven'))
    .filter((f) => f.endsWith('.yml'))
    .map((f) => parse(readFileSync(join(ROOT, 'content', 'uitgaven', f), 'utf-8')) ?? {})[0]
  const items = []

  if (!home.deelafbeeldingRegel) throw new Error('content/home.yml: deelafbeeldingRegel ontbreekt')
  items.push({
    key: 'home',
    variant: 'home',
    kleur: 'sage',
    titel: home.deelafbeeldingRegel,
    hoes: null,
  })

  for (const f of readdirSync(join(ROOT, 'content', 'paginas'))
    .filter((f) => f.endsWith('.md'))
    .sort()) {
    const d = kopblok(join(ROOT, 'content', 'paginas', f))
    const key = f.replace(/\.md$/, '')
    // Bestel de EP toont de hoes van de EP, als de eigenaar dat heeft toegestaan
    const metEpHoes = key === 'bestel-de-ep' && toegestaan.ep === true
    items.push({
      key,
      variant: metEpHoes ? 'hoes' : 'pagina',
      kleur: d.kleur ?? 'sage',
      titel: d.title,
      hoes: metEpHoes ? zoekBron(uitgave.cover) : null,
    })
  }

  for (const f of readdirSync(join(ROOT, 'content', 'nummers'))
    .filter((f) => f.endsWith('.md'))
    .sort()) {
    const d = kopblok(join(ROOT, 'content', 'nummers', f))
    const key = f.replace(/\.md$/, '')
    const metHoes = toegestaan.nummers.includes(key)
    items.push({
      key,
      variant: metHoes ? 'hoes' : 'pagina',
      kleur: 'lichtgoud',
      titel: d.title,
      hoes: metHoes ? zoekBron(d.cover?.src) : null,
    })
  }
  return items
}

// De hash van alles wat de afbeelding bepaalt: de gegevens van het item, de bestanden waar hij uit is gemaakt
// (logo, blaadje, takken, lettertype, hoes) en de versie van het sjabloon.
export function hashVan(item) {
  const invoer = {
    versie: SJABLOON_VERSIE,
    item: { ...item, hoes: item.hoes ? item.hoes.replace(ROOT, '') : null },
    kleur: KLEUREN[item.kleur],
    bestanden: Object.fromEntries(
      Object.entries(BESTANDEN).map(([naam, pad]) => [naam, sha256(readFileSync(pad))]),
    ),
    hoesBestand: item.hoes ? sha256(readFileSync(item.hoes)) : null,
  }
  return sha256(JSON.stringify(invoer))
}

export function leesManifest() {
  return existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf-8')) : {}
}

// Breedte en hoogte uit een JPEG, zonder pakket (voor de controle in de bouw)
export function jpegGrootte(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null
  let i = 2
  while (i + 9 < buffer.length) {
    if (buffer[i] !== 0xff) return null
    const marker = buffer[i + 1]
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
      return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) }
    i += 2 + buffer.readUInt16BE(i + 2)
  }
  return null
}
