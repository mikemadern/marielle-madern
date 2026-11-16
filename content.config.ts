import { defineCollection, defineContentConfig, z } from '@nuxt/content'

// Zie documenten/inhoud/contentmodel.md. De velden title en description zijn standaard aanwezig in
// een pagina-collectie. Nuxt Content controleert deze velden zelf niet streng: gebruik daarom
// `pnpm controle`, dat bij elke bouw draait.
const afbeelding = z.object({
  src: z.string(),
  alt: z.string(),
})

const knop = z.object({ tekst: z.string(), link: z.string() })

export default defineContentConfig({
  collections: {
    // Vaste pagina's: /over-mij/, /over-de-muziek/ (inleiding), /contact/, /bestel-de-ep/, /privacy/
    paginas: defineCollection({
      type: 'page',
      source: { include: 'paginas/*.md', prefix: '/' },
      schema: z.object({
        seoTitel: z.string().max(60).optional(),
        // Kleur van de kopbalk bovenaan de pagina
        kleur: z.enum(['sage', 'lichtgoud', 'blush']),
        // Titel in de kopbalk als die afwijkt van title. **tekst** wordt vet
        bannerTitel: z.string().optional(),
        // Handschriftregel boven de kop, en de kop zelf
        accent: z.string(),
        kop: z.string().optional(),
        accentKleur: z.enum(['goud', 'terracotta']).optional(),
        // Volgorde van de nummers op Over de muziek (bestandsnamen)
        nummerlijst: z.array(z.string()).optional(),
        // Tekst midden op de pagina in plaats van links
        midden: z.boolean().optional(),
        knop: knop.optional(),
        bijgewerkt: z.date().optional(),
      }),
    }),

    // Eén bestand per nummer: /over-de-muziek/{bestandsnaam}/
    nummers: defineCollection({
      type: 'page',
      source: { include: 'nummers/*.md', prefix: '/over-de-muziek' },
      schema: z.object({
        uitgave: z.enum(['ep', 'single']),
        volgorde: z.number().int().positive(),
        duur: z.string().regex(/^\d{1,2}:\d{2}$/, 'Gebruik m:ss, bijvoorbeeld 3:47'),
        // Eén korte regel voor de kaart op de homepage
        kaartregel: z.string(),
        uitgebracht: z.date().optional(),
        cover: afbeelding,
        videoBeeld: z.string(),
        youtube: z.string().regex(/^[\w-]{11}$/, 'Alleen de video-ID van 11 tekens'),
        spotify: z.string().regex(/^[A-Za-z0-9]{22}$/, 'Alleen de track-ID van 22 tekens'),
        // De volledige Apple Music-link naar dit nummer (https://music.apple.com/...). Leeg: de knop gaat naar de artiestpagina
        appleMusic: z.string().url().optional(),
        origineel: z.object({ titel: z.string(), artiest: z.string() }).optional(),
        verhaal: z.string(),
        bijzonder: z.string(),
        bijzonderKop: z.string().optional(),
        liedtekst: z.string(),
      }),
    }),

    // De EP, met de volgorde van de nummers en de prijs van de CD
    uitgaven: defineCollection({
      type: 'data',
      source: 'uitgaven/*.yml',
      schema: z.object({
        title: z.string(),
        type: z.enum(['ep']),
        cover: z.string(),
        nummers: z.array(z.string()),
        extra: z.array(z.string()),
        extraTekst: z.string(),
        cdPrijs: z.number(),
        verzendkosten: z.number(),
      }),
    }),

    // Teksten en volgorde van de homepage
    home: defineCollection({
      type: 'data',
      source: 'home.yml',
      schema: z.object({
        seoTitel: z.string().max(60),
        description: z.string(),
        heroRegels: z.array(z.object({ tekst: z.string(), vet: z.boolean() })),
        kicker: z.string(),
        slogan: z.string(),
        intro: z.array(z.string()),
        introKnop: knop,
        videoKicker: z.string(),
        videoKop: z.string(),
        videolijst: z.array(z.string()),
        // Het nummer dat bij het laden in de grote speler staat (bestandsnaam, moet in videolijst staan)
        uitgelicht: z.string(),
        uitgelichtRegel: z.string(),
        spelerNoot: z.string(),
        // Knoppen en woorden bij het uitgelichte nummer en de kaarten
        luisterSpotify: z.string(),
        luisterAppleMusic: z.string(),
        luisterYoutube: z.string(),
        verhaalKnop: z.string(),
        afspeelKnop: z.string(),
        duurWoord: z.string(),
        // EP-blok: de prijs staat in uitgaven/*.yml, {prijs} in epPrijs wordt daarmee vervangen
        epAccent: z.string(),
        epRegel: z.string(),
        epPrijs: z.string(),
        epCoverAlt: z.string(),
        epKnop: knop,
        // Contactblok
        contactKop: z.string(),
        contactRegel: z.string(),
        contactKnop: knop,
        // Volgorde van de nummers in de voet
        voetlijst: z.array(z.string()),
        muziekKnop: knop,
      }),
    }),
  },
})
