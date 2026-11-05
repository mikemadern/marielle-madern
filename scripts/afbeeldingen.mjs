// Maakt van de bronafbeeldingen in app/bronafbeeldingen vaste, kleine WebP-bestanden in public/afbeeldingen.
// Waarom niet tijdens het bouwen door Nuxt Image? Op Cloudflare geven bestandsnamen met een & in het pad
// een extra doorverwijzing (307) per afbeelding. Met gewone bestandsnamen is dat niet nodig.
// De breedtes moeten kloppen met app/providers/statisch.ts.
import { mkdir, readdir, stat } from 'node:fs/promises'
import { dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const BREEDTES = [300, 384, 600, 768, 1280]
const KWALITEIT = 80
const wortel = join(dirname(fileURLToPath(import.meta.url)), '..')
const bron = join(wortel, 'app', 'bronafbeeldingen')
const doel = join(wortel, 'public', 'afbeeldingen')

async function* bestanden(map) {
  for (const item of await readdir(map, { withFileTypes: true })) {
    const pad = join(map, item.name)
    if (item.isDirectory()) yield* bestanden(pad)
    else if (/\.(webp|jpe?g|png)$/i.test(item.name)) yield pad
  }
}

async function nieuwer(a, b) {
  try {
    return (await stat(a)).mtimeMs > (await stat(b)).mtimeMs
  } catch {
    return true
  }
}

let gemaakt = 0
let overgeslagen = 0

for await (const pad of bestanden(bron)) {
  const relatief = relative(bron, pad).replace(extname(pad), '')
  const { width } = await sharp(pad).metadata()
  if (!width || width < BREEDTES[0]) {
    console.warn(`Overgeslagen, te klein (${width}px): ${relatief}`)
    continue
  }
  for (const breedte of BREEDTES.filter((b) => b <= width)) {
    const uit = join(doel, `${relatief}-${breedte}.webp`)
    if (!(await nieuwer(pad, uit))) {
      overgeslagen++
      continue
    }
    await mkdir(dirname(uit), { recursive: true })
    await sharp(pad).resize({ width: breedte }).webp({ quality: KWALITEIT }).toFile(uit)
    gemaakt++
  }
}

console.log(`Afbeeldingen: ${gemaakt} gemaakt, ${overgeslagen} al actueel.`)
