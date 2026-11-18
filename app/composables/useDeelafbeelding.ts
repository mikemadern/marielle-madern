// Deelafbeelding van een pagina (og:image en twitter:image). De bestanden maakt scripts/deelafbeeldingen.mjs:
// 'algemeen' (logo), 'ep' (hoes van de EP) of de bestandsnaam van een nummer. Het adres wordt vanzelf
// absoluut (https://mariellemadern.nl/...) door site.url.
import toegestaan from '../../scripts/deelafbeeldingen-toegestaan.json'

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

// Een nummer: titel en hoes als het nummer op de toegestane lijst staat (scripts/deelafbeeldingen-toegestaan.json),
// anders titel en logo. De bestandsnaam is de naam van het nummer. De alt bevat de tekst op de afbeelding.
export function useNummerDeelafbeelding(slug: string, titel: string) {
  const metHoes = toegestaan.nummers.includes(slug)
  useDeelafbeelding(
    slug,
    metHoes
      ? `Hoes van ${titel}, nummer van Mariëlle Madern`
      : `${titel}, nummer van Mariëlle Madern`,
  )
}

// Een pagina uit content/paginas: de bestandsnaam is de naam van de pagina (over-mij, contact, bestel-de-ep).
// Bestel de EP toont de hoes van de EP, als de eigenaar dat heeft toegestaan.
export function usePaginaDeelafbeelding(pad: string, titel: string) {
  const naam = pad.replace(/^\/|\/$/g, '')
  const metEpHoes = naam === 'bestel-de-ep' && toegestaan.ep
  useDeelafbeelding(
    naam,
    metEpHoes
      ? `${titel} U ziet mij van Mariëlle Madern, met de hoes`
      : `Mariëlle Madern: ${titel}`,
  )
}
