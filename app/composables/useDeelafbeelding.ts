// Deelafbeelding van een pagina (og:image en twitter:image). De bestanden maakt scripts/deelafbeeldingen.mjs:
// 'algemeen' (logo), 'ep' (hoes van de EP) of de bestandsnaam van een nummer. Het adres wordt vanzelf
// absoluut (https://mariellemadern.nl/...) door site.url.
import deelafbeeldingen from '~/data/deelafbeeldingen.json'

export function useDeelafbeelding(naam: string, alt: string) {
  const url = `/afbeeldingen/og/${naam}.jpg`
  useSeoMeta({
    ogImage: url,
    ogImageAlt: alt,
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageType: 'image/jpeg',
    twitterCard: 'summary_large_image',
    twitterImage: url,
    twitterImageAlt: alt,
  })
}

// Een nummer: de hoes als het nummer op de toegestane lijst staat (app/data/deelafbeeldingen.json), anders het logo.
// De bestandsnaam is in beide gevallen de naam van het nummer.
export function useNummerDeelafbeelding(slug: string, titel: string) {
  const metHoes = deelafbeeldingen.hoezen.includes(slug)
  useDeelafbeelding(slug, metHoes ? `Hoes van ${titel}` : 'Logo van Mariëlle Madern')
}

// Bestel de EP: de hoes van de EP als de eigenaar dat heeft toegestaan, anders het logo
export function useEpDeelafbeelding() {
  useDeelafbeelding(
    'ep',
    deelafbeeldingen.epHoes ? 'Hoes van de EP U ziet mij' : 'Logo van Mariëlle Madern',
  )
}
