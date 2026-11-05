import { defineCollection, defineContentConfig, z } from '@nuxt/content'

// Schets uit documenten/inhoud/contentmodel.md. De velden title en description zijn standaard aanwezig.
const afbeelding = z.object({
  src: z.string(),
  alt: z.string(),
})

export default defineContentConfig({
  collections: {
    // Vaste pagina's: /over-mij/, /contact/, /bestel-de-ep/, /privacy/
    paginas: defineCollection({
      type: 'page',
      source: { include: 'paginas/*.md', prefix: '/' },
      schema: z.object({
        seoTitel: z.string().max(60).optional(),
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
        uitgebracht: z.date().optional(),
        cover: afbeelding,
        youtube: z.string().regex(/^[\w-]{11}$/, 'Alleen de video-ID van 11 tekens'),
        spotify: z.string().regex(/^[A-Za-z0-9]{22}$/, 'Alleen de track-ID van 22 tekens'),
        origineel: z.object({ titel: z.string(), artiest: z.string() }).optional(),
        liedtekst: z.string(),
      }),
    }),
  },
})
