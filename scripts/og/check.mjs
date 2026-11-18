// Controleert of de deelafbeeldingen in public/afbeeldingen/og nog bij de gegevens passen. Faalt (exit 1) als een
// afbeelding ontbreekt, niet meer past bij titel, kleur, hoes, logo, blaadje, takken, lettertype of sjabloon, niet
// 1200 x 630 is, te groot is, handmatig is aangepast, bij niets meer hoort, een hoes gebruikt van een nummer buiten de
// toegestane lijst, of een titel heeft die op meer dan twee regels staat. Maakt zelf niets: dat doet pnpm og.
// Draait zonder satori of sharp en zonder netwerk, in de bouw (pnpm generate) en dus ook in Workers Builds.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  HEIGHT,
  MAX_BYTES,
  OUT_DIR,
  ROOT,
  WIDTH,
  hashVan,
  jpegGrootte,
  laadItems,
  leesManifest,
  sha256,
} from './data.mjs'

const items = laadItems()
const manifest = leesManifest()
const toegestaan = JSON.parse(
  readFileSync(join(ROOT, 'scripts', 'deelafbeeldingen-toegestaan.json'), 'utf-8'),
)
const fouten = []

for (const item of items) {
  const naam = `${item.key}.jpg`
  const bestand = join(OUT_DIR, naam)
  const regel = manifest[item.key]
  if (!existsSync(bestand)) {
    fouten.push(`${naam} ontbreekt`)
    continue
  }
  const buffer = readFileSync(bestand)
  if (!regel) fouten.push(`${naam} staat niet in manifest.json`)
  else if (regel.hash !== hashVan(item))
    fouten.push(
      `${naam} past niet meer bij de gegevens (titel, kleur, hoes, logo, blaadje, takken, lettertype of sjabloon is gewijzigd)`,
    )
  else if (regel.bestand !== sha256(buffer))
    fouten.push(`${naam} is gewijzigd na het maken (niet door pnpm og)`)
  const grootte = jpegGrootte(buffer)
  if (!grootte || grootte.width !== WIDTH || grootte.height !== HEIGHT)
    fouten.push(
      `${naam} is ${grootte ? `${grootte.width} x ${grootte.height}` : 'geen geldige jpg'}, moet ${WIDTH} x ${HEIGHT} zijn`,
    )
  if (buffer.length > MAX_BYTES)
    fouten.push(
      `${naam} is ${Math.round(buffer.length / 1000)} KB, groter dan ${MAX_BYTES / 1000} KB`,
    )

  // Privacy: een hoes mag alleen als het nummer op de toegestane lijst staat (en bij Bestel de EP als de EP-hoes is toegestaan)
  const mag =
    item.key === 'bestel-de-ep' ? toegestaan.ep === true : toegestaan.nummers.includes(item.key)
  if (regel?.hoes && !mag)
    fouten.push(
      `${naam} gebruikt een hoes die niet op de toegestane lijst staat (scripts/deelafbeeldingen-toegestaan.json)`,
    )
  if (regel && regel.regels > 2)
    fouten.push(`${naam}: de titel staat op ${regel.regels} regels, hoogstens 2`)
}

const namen = new Set(items.map((item) => item.key))
for (const f of readdirSync(OUT_DIR))
  if (f.endsWith('.jpg') && !namen.has(f.slice(0, -4)))
    fouten.push(`${f} hoort bij geen pagina of nummer meer`)
for (const key of Object.keys(manifest))
  if (!namen.has(key))
    fouten.push(`manifest.json noemt ${key}, maar dat is geen pagina of nummer meer`)

if (fouten.length) {
  console.error('Deelafbeeldingen kloppen niet meer met de gegevens:')
  for (const fout of fouten) console.error(`  - ${fout}`)
  console.error(
    'Maak ze opnieuw met: pnpm og   (uitleg: README.md, "Deelafbeeldingen"), en commit public/afbeeldingen/og/.',
  )
  process.exit(1)
}
console.log(
  `Deelafbeeldingen in orde: ${items.length} van ${items.length} (public/afbeeldingen/og/).`,
)
