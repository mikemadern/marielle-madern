// Maakt worker/bladmuziek.json: de nummers waar in de content `bladmuziek: true` bij staat, met hun titel.
// De Worker leest dat om te weten voor welke nummers hij bladmuziek mag sturen en welke titel in de mail komt
// (de titel komt dus nooit van de bezoeker). Het bestand staat niet in git; het ontstaat bij elke bouw.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const wortel = fileURLToPath(new URL('..', import.meta.url))
const map = join(wortel, 'content', 'nummers')
const lijst = {}
for (const f of readdirSync(map)
  .filter((f) => f.endsWith('.md'))
  .sort()) {
  const m = readFileSync(join(map, f), 'utf-8').match(/^---\n([\s\S]*?)\n---/)
  const d = parse(m?.[1] ?? '') ?? {}
  if (d.bladmuziek === true) lijst[f.replace(/\.md$/, '')] = { titel: String(d.title) }
}
mkdirSync(join(wortel, 'worker'), { recursive: true })
writeFileSync(join(wortel, 'worker', 'bladmuziek.json'), JSON.stringify(lijst, null, 2) + '\n')
console.log(`Bladmuziek: ${Object.keys(lijst).length} nummer(s) met bladmuziek.`)
