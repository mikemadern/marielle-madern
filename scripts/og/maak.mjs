// Maakt de deelafbeeldingen (og:image en twitter:image, 1200 x 630) in public/afbeeldingen/og en schrijft
// manifest.json daar. Sjabloon: Designer (design/deelafbeeldingen.md): kleurvlak per pagina, twee takken, een
// crème paneel met logo, blaadje en titel (of hoes, titel en logo). Techniek: satori (tekst en vormen) en sharp (jpg).
//
// Gebruik:  pnpm og                  alle afbeeldingen opnieuw maken
//           pnpm og over-mij         alleen de genoemde (naam van de pagina of het nummer)
// Niets hiervan draait in de bouw: de afbeeldingen staan in git en de bouw controleert ze met pnpm og:check.
// Lettertype: Mukta 400 (SIL Open Font License 1.1) uit @fontsource/mukta, als woff (satori leest geen woff2).
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import satori from 'satori'
import sharp from 'sharp'
import {
  BESTANDEN,
  CREME,
  HEIGHT,
  KLEUREN,
  MANIFEST,
  MAX_BYTES,
  OUT_DIR,
  TEKST,
  WIDTH,
  hashVan,
  laadItems,
  sha256,
  titelGrootte,
} from './data.mjs'

const fonts = [
  { name: 'Mukta', data: readFileSync(BESTANDEN.fontLatin), weight: 400, style: 'normal' },
  { name: 'Mukta', data: readFileSync(BESTANDEN.fontExt), weight: 400, style: 'normal' },
]
const uri = (svg) => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
const logo = uri(readFileSync(BESTANDEN.logo, 'utf-8'))
// Het blaadje tekent met currentColor; als afbeelding is dat zwart
const blad = uri(readFileSync(BESTANDEN.blad, 'utf-8').replaceAll('currentColor', '#000000'))
// De takken: de lijn in een donkere tint (de dekking van 20% staat al in het bestand)
const takken = uri(readFileSync(BESTANDEN.takken, 'utf-8').replaceAll('#52613b', '#2d3520'))

const el = (type, style, props = {}) => ({
  type,
  props: { style: { display: 'flex', ...style }, ...props },
})
const img = (src, width, height, style = {}) => ({
  type: 'img',
  props: { src, width, height, style: { display: 'flex', ...style } },
})

const only = process.argv.slice(2)
const items = laadItems()
const onbekend = only.filter((naam) => !items.some((item) => item.key === naam))
if (onbekend.length) {
  console.error(
    `Onbekende naam: ${onbekend.join(', ')}. Mogelijk: ${items.map((i) => i.key).join(', ')}`,
  )
  process.exit(1)
}

function titelElement(item, grootte, extra = {}) {
  return el(
    'div',
    {
      fontFamily: 'Mukta',
      fontWeight: 400,
      fontSize: grootte,
      lineHeight: 1.1,
      letterSpacing: '-0.02em',
      color: TEKST,
      textAlign: 'center',
      justifyContent: 'center',
      maxWidth: 512,
      textWrap: 'balance',
      ...extra,
    },
    { children: item.titel },
  )
}

// Het aantal regels van de titel meten: satori zonder ingebed lettertype zet elke regel als eigen <text>
async function telRegels(item, grootte) {
  const svg = await satori(el('div', { width: 512 }, { children: titelElement(item, grootte) }), {
    width: 512,
    height: 400,
    fonts,
    embedFont: false,
  })
  return new Set([...svg.matchAll(/<text[^>]* y="([\d.]+)"/g)].map((m) => m[1])).size
}

async function hoesUri(pad) {
  const buffer = await sharp(pad).resize(500, 500, { fit: 'cover' }).png().toBuffer()
  return 'data:image/png;base64,' + buffer.toString('base64')
}

async function boom(item) {
  let grootte
  let inhoud
  if (item.variant === 'home') {
    inhoud = [
      img(logo, 440, 114),
      img(blad, 170, 52, { marginTop: 22, marginBottom: 14 }),
      // De regel van de home breekt gewoon op de breedte (geen balans): 'Oprechte en authentieke' / 'aanbidding'
      titelElement(item, 36, { lineHeight: 1.25, marginTop: 4, textWrap: 'wrap' }),
    ]
  } else if (item.variant === 'hoes') {
    grootte = titelGrootte(item.titel.length, 'hoes')
    inhoud = [
      el(
        'div',
        {
          width: 250,
          height: 250,
          borderRadius: 14,
          border: '1px solid rgba(65,66,60,0.15)',
          overflow: 'hidden',
        },
        { children: img(await hoesUri(item.hoes), 248, 248, { borderRadius: 13 }) },
      ),
      titelElement(item, grootte, { marginTop: 22 }),
      img(logo, 190, 49, { marginTop: 18 }),
    ]
  } else {
    grootte = titelGrootte(item.titel.length, 'pagina')
    inhoud = [
      img(logo, 300, 78),
      img(blad, 170, 52, { marginTop: 22, marginBottom: 14 }),
      titelElement(item, grootte),
    ]
  }
  const tree = el(
    'div',
    {
      position: 'relative',
      width: WIDTH,
      height: HEIGHT,
      background: KLEUREN[item.kleur],
      overflow: 'hidden',
    },
    {
      children: [
        img(takken, 980, 426, { position: 'absolute', left: -470, top: 150 }),
        img(takken, 980, 426, {
          position: 'absolute',
          left: 690,
          top: -150,
          transform: 'scaleX(-1)',
        }),
        el(
          'div',
          {
            position: 'absolute',
            left: 300,
            top: 55,
            width: 600,
            height: 520,
            boxSizing: 'border-box',
            borderRadius: 28,
            background: CREME,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '34px 44px',
          },
          { children: inhoud },
        ),
      ],
    },
  )
  return { tree, grootte }
}

mkdirSync(OUT_DIR, { recursive: true })
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8').trim() || '{}')
const fouten = []

for (const item of items) {
  if (only.length && !only.includes(item.key)) continue
  const { tree, grootte } = await boom(item)
  let regels = 1
  if (grootte) {
    regels = await telRegels(item, grootte)
    if (regels > 2) {
      fouten.push(
        `${item.key}: de titel "${item.titel}" is ${regels} regels op ${grootte} px; hoogstens 2 (kort de titel in of overleg met de Designer)`,
      )
      continue
    }
  }
  const svg = await satori(tree, { width: WIDTH, height: HEIGHT, fonts })
  const jpg = await sharp(Buffer.from(svg))
    .jpeg({ quality: 82, mozjpeg: true, progressive: true })
    .toBuffer()
  if (jpg.length > MAX_BYTES) {
    fouten.push(`${item.key}.jpg is ${jpg.length} bytes, maximaal ${MAX_BYTES}`)
    continue
  }
  writeFileSync(join(OUT_DIR, `${item.key}.jpg`), jpg)
  manifest[item.key] = {
    variant: item.variant,
    titel: item.titel,
    kleur: item.kleur,
    hoes: item.hoes !== null,
    regels,
    breedte: WIDTH,
    hoogte: HEIGHT,
    bytes: jpg.length,
    formaat: 'jpeg',
    hash: hashVan(item),
    bestand: sha256(jpg),
  }
  console.log(`${item.key.padEnd(28)} ${Math.round(jpg.length / 1024)} KB`)
}

// Opruimen: afbeeldingen en regels in het manifest die bij niets meer horen
if (!only.length) {
  const namen = new Set(items.map((i) => i.key))
  for (const f of readdirSync(OUT_DIR))
    if (f.endsWith('.jpg') && !namen.has(f.slice(0, -4))) rmSync(join(OUT_DIR, f))
  for (const key of Object.keys(manifest)) if (!namen.has(key)) delete manifest[key]
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')

if (fouten.length) {
  console.error('\nDeelafbeeldingen niet gemaakt:\n' + fouten.map((f) => `  - ${f}`).join('\n'))
  process.exit(1)
}
