// Verdeelt de verzoeken aan /api/ over de eindpunten van de Worker. Geeft null voor al het andere (dat gaat naar de
// statische bestanden) en 404 voor een onbekend /api-pad (dat laat bladmuziek.mjs doen).
import { behandel as behandelBladmuziek } from './bladmuziek.mjs'
import { behandel as behandelContact, PAD as CONTACT_PAD } from './contact.mjs'
import { behandel as behandelNieuwsbrief, PAD as NIEUWSBRIEF_PAD } from './nieuwsbrief.mjs'

export async function behandel(request, env, deps) {
  const url = new URL(request.url)
  if (url.pathname === CONTACT_PAD) return behandelContact(request, env, deps)
  if (url.pathname === NIEUWSBRIEF_PAD) return behandelNieuwsbrief(request, env, deps)
  return behandelBladmuziek(request, env, deps)
}
