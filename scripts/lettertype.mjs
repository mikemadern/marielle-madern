// Maakt de WOFF2-subset van het handschriftlettertype Atlantis (licentie: webgebruik en omzetten zijn toegestaan).
// Het bron-TTF staat niet in deze repository. Gebruik: node scripts/lettertype.mjs pad/naar/atlantis-Regular.ttf
import { readFile, writeFile } from 'node:fs/promises'
import subsetFont from 'subset-font'

const bron = process.argv[2]
if (!bron) {
  console.error('Geef het pad naar atlantis-Regular.ttf op.')
  process.exit(1)
}

// Alleen de tekens die we in Nederlandse tekst nodig hebben, met accenten en leestekens
const tekens =
  ' abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;!?-–—’‘“”\'"()éëïöüáàäâêèîôûçÉËÏÖÜ'

const uit = await subsetFont(await readFile(bron), tekens, { targetFormat: 'woff2' })
await writeFile(new URL('../app/assets/fonts/atlantis.woff2', import.meta.url), uit)
console.log(`atlantis.woff2: ${Math.round(uit.length / 1024)} KB`)
