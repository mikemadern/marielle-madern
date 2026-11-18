// Maakt per pagina een deelafbeelding (og:image en twitter:image) van 1200 x 630 pixels, als JPEG in
// public/afbeeldingen/og/. Voorbeeld: een nummerpagina toont de hoes op de crème achtergrond, de overige
// pagina's het logo. Er is geen lettertype nodig: de hoes heeft de titel en naam al in beeld, de titel
// van de pagina staat in og:title.
// Draait bij elke bouw (pnpm generate), na pnpm afbeeldingen. Nieuwe nummers komen vanzelf mee.
// Waarom JPEG en niet WebP? WhatsApp, Facebook en LinkedIn tonen JPEG en PNG het betrouwbaarst.
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { parse } from 'yaml'

const BREEDTE = 1200
const HOOGTE = 630
const HOES = 500 // de hoes is vierkant, in het midden zodat ook een vierkante uitsnede hem compleet houdt
const LOGO_BREEDTE = 760
const KWALITEIT = 82
const MAX_BYTES = 150_000

const wortel = fileURLToPath(new URL('..', import.meta.url))
const bron = join(wortel, 'app', 'bronafbeeldingen')
const doel = join(wortel, 'public', 'afbeeldingen', 'og')
const logoPad = join(wortel, 'public', 'logo', 'mariellemadern-logo-donker.svg')

// De achtergrond is de crème uit de huisstijl, zodat de afbeelding niet los staat van tokens.css
const tokens = await readFile(join(wortel, 'app', 'assets', 'css', 'tokens.css'), 'utf-8')
const hex = tokens.match(/--kleur-creme:\s*#([0-9a-fA-F]{6})/)?.[1]
if (!hex) throw new Error('--kleur-creme staat niet in app/assets/css/tokens.css')
const creme = {
  r: parseInt(hex.slice(0, 2), 16),
  g: parseInt(hex.slice(2, 4), 16),
  b: parseInt(hex.slice(4, 6), 16),
}

function zoekBron(src) {
  const kaal = String(src).replace(/\.[^./]+$/, '')
  for (const ext of ['webp', 'jpg', 'jpeg', 'png']) {
    const pad = join(bron, `${kaal}.${ext}`)
    if (existsSync(pad)) return pad
  }
  throw new Error(`Bronafbeelding ${src} staat niet in app/bronafbeeldingen`)
}

async function kopblok(pad) {
  const m = (await readFile(pad, 'utf-8')).match(/^---\n([\s\S]*?)\n---/)
  return parse(m?.[1] ?? '') ?? {}
}

// Welke hoezen als deelafbeelding mogen (besluit van de eigenaar, 2026-11-18). Een nieuw nummer staat hier
// niet op en krijgt dus het logo, tot de eigenaar akkoord geeft en het nummer op de lijst komt. De hero-poster
// en een portret van Mariëlle worden hier nooit gebruikt.
const toegestaanPad = join(wortel, 'scripts', 'deelafbeeldingen-toegestaan.json')
const toegestaan = JSON.parse(await readFile(toegestaanPad, 'utf-8'))
const zonderHoes = []

// Wat er gemaakt moet worden: naam van het bestand, en de bron (een hoes, of null voor het logo)
const lijst = [{ naam: 'algemeen', bron: null }]
for (const f of (await readdir(join(wortel, 'content', 'nummers')))
  .filter((f) => f.endsWith('.md'))
  .sort()) {
  const d = await kopblok(join(wortel, 'content', 'nummers', f))
  const naam = f.replace(/\.md$/, '')
  const mag = toegestaan.nummers.includes(naam)
  if (!mag) zonderHoes.push(naam)
  lijst.push({ naam, bron: mag ? zoekBron(d.cover?.src) : null })
}
for (const f of (await readdir(join(wortel, 'content', 'uitgaven'))).filter((f) =>
  f.endsWith('.yml'),
)) {
  const d = parse(await readFile(join(wortel, 'content', 'uitgaven', f), 'utf-8')) ?? {}
  lijst.push({ naam: 'ep', bron: toegestaan.ep === true ? zoekBron(d.cover) : null })
}

const nieuwer = async (a, b) => {
  try {
    return (await stat(a)).mtimeMs > (await stat(b)).mtimeMs
  } catch {
    return true
  }
}

await mkdir(doel, { recursive: true })
const manifest = {}
const fouten = []
let gemaakt = 0

for (const { naam, bron: pad } of lijst) {
  const uit = join(doel, `${naam}.jpg`)
  const invoer = pad ?? logoPad
  const verouderd =
    (await nieuwer(invoer, uit)) ||
    (await nieuwer(fileURLToPath(import.meta.url), uit)) ||
    (await nieuwer(toegestaanPad, uit)) ||
    (await nieuwer(join(wortel, 'app', 'assets', 'css', 'tokens.css'), uit))
  if (verouderd) {
    const voorgrond = pad
      ? await sharp(pad).resize(HOES, HOES).toBuffer()
      : await sharp(logoPad, { density: 300 }).resize({ width: LOGO_BREEDTE }).png().toBuffer()
    const { width, height } = await sharp(voorgrond).metadata()
    await sharp({ create: { width: BREEDTE, height: HOOGTE, channels: 3, background: creme } })
      .composite([
        {
          input: voorgrond,
          left: Math.round((BREEDTE - width) / 2),
          top: Math.round((HOOGTE - height) / 2),
        },
      ])
      .jpeg({ quality: KWALITEIT, mozjpeg: true, progressive: true })
      .toFile(uit)
    gemaakt++
  }
  const meta = await sharp(uit).metadata()
  const { size } = await stat(uit)
  manifest[naam] = {
    breedte: meta.width,
    hoogte: meta.height,
    bytes: size,
    formaat: meta.format,
    hoes: pad !== null,
  }
  if (meta.width !== BREEDTE || meta.height !== HOOGTE || meta.format !== 'jpeg')
    fouten.push(
      `${naam}.jpg is ${meta.width}x${meta.height} ${meta.format}, verwacht ${BREEDTE}x${HOOGTE} jpeg`,
    )
  if (size > MAX_BYTES) fouten.push(`${naam}.jpg is ${size} bytes, maximaal ${MAX_BYTES}`)
}

await writeFile(join(doel, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

if (fouten.length) {
  console.error('Deelafbeeldingen:\n' + fouten.map((f) => `  - ${f}`).join('\n'))
  process.exit(1)
}
console.log(`Deelafbeeldingen: ${gemaakt} gemaakt, ${lijst.length - gemaakt} al actueel.`)
if (zonderHoes.length)
  console.log(`Zonder hoes (niet op de toegestane lijst, logo gebruikt): ${zonderHoes.join(', ')}`)
