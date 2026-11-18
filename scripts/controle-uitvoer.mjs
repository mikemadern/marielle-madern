// Controleert de gebouwde HTML in .output/public (draait aan het eind van pnpm generate).
// Eerst de gegevens in content/ (scripts/controle.mjs), nu wat er echt in de pagina's staat.
// Een fout stopt de bouw, dus ook de bouw van Cloudflare Workers Builds.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const SITE = 'https://mariellemadern.nl'
const wortel = fileURLToPath(new URL('..', import.meta.url))
const uitvoer = join(wortel, '.output', 'public')
const fouten = []

function* paginas(map) {
  for (const item of readdirSync(map, { withFileTypes: true })) {
    const pad = join(map, item.name)
    if (item.isDirectory()) {
      if (!item.name.startsWith('_') && !item.name.startsWith('__')) yield* paginas(pad)
    } else if (item.name === 'index.html') yield pad
  }
}

// Alle <meta>-tags van een pagina als lijst van { property of name, content }
function metaTags(html) {
  return [...html.matchAll(/<meta\s+([^>]*?)\/?>/g)].map(([, attrs]) => {
    const o = {}
    for (const [, k, v] of attrs.matchAll(/([\w:-]+)="([^"]*)"/g)) o[k] = v
    return o
  })
}

const meta = (tags, sleutel) =>
  tags.find((t) => t.property === sleutel || t.name === sleutel)?.content

const lijst = [...paginas(uitvoer)]
if (lijst.length < 15)
  fouten.push(`Er zijn maar ${lijst.length} pagina's gebouwd, verwacht minstens 15`)

for (const pad of lijst) {
  const route = '/' + relative(uitvoer, pad).replace(/index\.html$/, '')
  const fout = (tekst) => fouten.push(`${route}: ${tekst}`)
  const html = readFileSync(pad, 'utf-8')
  const tags = metaTags(html)

  // Canonical: absoluut, op het echte domein, met slash aan het eind
  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1]
  if (canonical !== `${SITE}${route}`) fout(`canonical is ${canonical}, verwacht ${SITE}${route}`)
  if (meta(tags, 'og:url') !== `${SITE}${route}`) fout(`og:url is ${meta(tags, 'og:url')}`)

  // Deelafbeelding: JPEG van 1200 x 630 op het echte domein, met alt, en dezelfde voor Twitter
  const ogImage = meta(tags, 'og:image')
  if (!ogImage?.startsWith(`${SITE}/afbeeldingen/og/`) || !ogImage.endsWith('.jpg')) {
    fout(`og:image is ${ogImage}, verwacht ${SITE}/afbeeldingen/og/<naam>.jpg`)
  } else {
    const bestandPad = join(uitvoer, ogImage.slice(SITE.length))
    if (!existsSync(bestandPad)) fout(`og:image bestaat niet in de bouw: ${ogImage}`)
    else if (statSync(bestandPad).size > 150_000) fout(`${ogImage} is groter dan 150 KB`)
  }
  if (meta(tags, 'twitter:image') !== ogImage) fout('twitter:image is niet gelijk aan og:image')
  if (!meta(tags, 'og:image:alt')?.trim()) fout('og:image:alt ontbreekt')
  if (!meta(tags, 'twitter:image:alt')?.trim()) fout('twitter:image:alt ontbreekt')
  if (meta(tags, 'og:image:width') !== '1200' || meta(tags, 'og:image:height') !== '630')
    fout('og:image:width/height moeten 1200 en 630 zijn')
  if (meta(tags, 'twitter:card') !== 'summary_large_image')
    fout(`twitter:card is ${meta(tags, 'twitter:card')}, verwacht summary_large_image`)
  if (meta(tags, 'og:locale') !== 'nl_NL')
    fout(`og:locale is ${meta(tags, 'og:locale')}, verwacht nl_NL`)

  // De deelafbeelding van de homepage hoort bij het uitgelichte nummer (home.yml, veld uitgelicht); zonder dat veld het logo
  if (route === '/') {
    // content/home.yml, veld uitgelicht; zonder dat veld het logo
    const homeYml = readFileSync(join(wortel, 'content', 'home.yml'), 'utf-8')
    const verwacht = homeYml.match(/^uitgelicht:\s*(\S+)/m)?.[1] ?? 'algemeen'
    if (!ogImage?.endsWith(`/afbeeldingen/og/${verwacht}.jpg`))
      fout(`de deelafbeelding van de homepage moet ${verwacht}.jpg zijn, niet ${ogImage}`)
    controleerHero(html, fout)
  }
}

// [hero-poster] De hero heeft een poster die direct in de pagina staat (stilstaand beeld uit de video)
function controleerHero(html, fout) {
  const poster = html.match(/<img[^>]*hero__poster[^>]*>/)?.[0]
  if (!poster) return fout('de hero heeft geen poster (<img class="hero__poster">)')
  if (!/fetchpriority="high"/.test(poster) || /loading="lazy"/.test(poster))
    fout('de poster moet fetchpriority=high hebben en niet lazy zijn')
  if (!/width="\d+"/.test(poster) || !/height="\d+"/.test(poster))
    fout('de poster heeft width en height nodig (geen verspringing)')
  const src = poster.match(/\ssrc="([^"]+)"/)?.[1]
  if (!src || !existsSync(join(uitvoer, src)))
    fout(`het poster-bestand bestaat niet in de bouw: ${src}`)
}

// Privacy: een hoes mag alleen als deelafbeelding als het nummer op de toegestane lijst staat
const toegestaan = JSON.parse(
  readFileSync(join(wortel, 'scripts', 'deelafbeeldingen-toegestaan.json'), 'utf-8'),
)
const manifest = JSON.parse(
  readFileSync(join(uitvoer, 'afbeeldingen', 'og', 'manifest.json'), 'utf-8'),
)
for (const [naam, m] of Object.entries(manifest)) {
  const mag = naam === 'ep' ? toegestaan.ep === true : toegestaan.nummers.includes(naam)
  if (m.hoes && !mag)
    fouten.push(
      `${naam}.jpg gebruikt een hoes die niet op de toegestane lijst staat (scripts/deelafbeeldingen-toegestaan.json)`,
    )
}

// De afbeeldingen zelf: 1200 x 630, JPEG
for (const f of readdirSync(join(uitvoer, 'afbeeldingen', 'og')).filter((f) =>
  f.endsWith('.jpg'),
)) {
  const m = await sharp(join(uitvoer, 'afbeeldingen', 'og', f)).metadata()
  if (m.width !== 1200 || m.height !== 630 || m.format !== 'jpeg')
    fouten.push(`afbeeldingen/og/${f} is ${m.width}x${m.height} ${m.format}`)
}

if (fouten.length) {
  console.error(`Uitvoer: ${fouten.length} fout(en)\n` + fouten.map((f) => `  - ${f}`).join('\n'))
  process.exit(1)
}
console.log(`Uitvoer: alles in orde (${lijst.length} pagina's).`)
