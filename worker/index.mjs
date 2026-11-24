// Kleine Worker naast de statische site (wrangler.jsonc: assets.run_worker_first alleen voor /api/*).
// Alles wat geen /api/-verzoek is, gaat rechtstreeks naar de statische bestanden en komt hier niet langs.
// worker/bladmuziek.json (de nummers met bladmuziek) maakt scripts/bladmuziek-lijst.mjs bij elke bouw.
import lijst from './bladmuziek.json'
import { behandel } from './api.mjs'

export default {
  async fetch(request, env) {
    const uitslag = await behandel(request, env, { lijst, fetch: (...args) => fetch(...args) })
    return uitslag ?? env.ASSETS.fetch(request)
  },
}
