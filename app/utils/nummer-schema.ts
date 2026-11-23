import { isoDuur } from './iso-duur'

// Eén plek voor de schema.org-gegevens van een nummer, voor de nummerpagina en voor het uitgelichte nummer
// op de homepage. Alleen gegevens uit de content: geen uitgavedatum, geen origineel nummer en geen liedtekst,
// want die zijn nog niet bevestigd. De EP staat erin als het nummer in content/uitgaven staat.
interface NummerVoorSchema {
  path: string
  title: string
  duur: string
  cover: { src: string }
  spotify: string
  youtube: string
}

export function nummerSchema(
  site: string,
  nummer: NummerVoorSchema,
  uitgave?: { title: string; nummers: string[] } | null,
) {
  const url = `${site}${nummer.path}/`
  const slug = nummer.path.split('/').pop() ?? ''
  const cover = nummer.cover.src.replace(/^\//, '').replace(/\.[^./]+$/, '')
  return {
    '@id': `${url}#nummer`,
    name: nummer.title,
    url,
    inLanguage: 'nl',
    duration: isoDuur(nummer.duur),
    image: `${site}/afbeeldingen/${cover}-600.webp`,
    byArtist: { '@id': `${site}/#identity` },
    sameAs: [
      `https://open.spotify.com/track/${nummer.spotify}`,
      `https://www.youtube.com/watch?v=${nummer.youtube}`,
    ],
    ...(uitgave?.nummers.includes(slug)
      ? { inAlbum: { '@type': 'MusicAlbum', name: uitgave.title, url: `${site}/bestel-de-ep/` } }
      : {}),
  }
}
