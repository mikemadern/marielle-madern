// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxt/content', '@nuxtjs/seo', '@nuxt/image', '@nuxt/eslint'],

  css: ['~/assets/css/tokens.css', '~/assets/css/basis.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'nl' },
      // Adobe Fonts-kit (besluit 2026-11-05). Preconnect scheelt tijd bij het laden van het lettertype.
      link: [
        { rel: 'preconnect', href: 'https://use.typekit.net', crossorigin: 'anonymous' },
        { rel: 'preconnect', href: 'https://p.typekit.net', crossorigin: 'anonymous' },
        { rel: 'stylesheet', href: 'https://use.typekit.net/bxn6xtn.css' },
        { rel: 'icon', type: 'image/webp', href: '/favicon.webp' },
      ],
    },
  },

  // Gegevens voor @nuxtjs/seo: canonieke URL's, sitemap, schema.org
  site: {
    url: 'https://mariellemadern.nl',
    name: 'Mariëlle Madern',
    description:
      'Nederlandstalige christelijke aanbiddingsmuziek van Mariëlle Madern, door oprechte en authentieke aanbidding.',
    defaultLocale: 'nl',
    // De huidige URL's eindigen op een slash en dat blijft zo (besluit 2026-11-05)
    trailingSlash: true,
  },

  content: {
    // Tijdens het bouwen gebruikt Content SQLite. De ingebouwde node:sqlite (Node 22.5 of nieuwer)
    // scheelt een extra pakket met een native onderdeel.
    experimental: { sqliteConnector: 'native' },
  },

  // Deelafbeeldingen maken we later (fase 6), eerst zonder
  ogImage: { enabled: false },

  image: {
    // Eigen provider: verwijst naar vooraf gemaakte bestanden (scripts/afbeeldingen.mjs).
    provider: 'statisch',
    providers: {
      statisch: { provider: '~/providers/statisch' },
    },
  },

  // Niet gevraagd: llms.txt en Markdown-kopieën van elke pagina. Staat uit, kan later aan.
  aiReady: false,

  // Bewaart oude bestanden van eerdere versies voor bezoekers met een oude pagina. Bij statische
  // bestanden op Cloudflare is dat niet nodig, en het nam bestanden van testbouwen mee.
  skewProtection: false,

  // Alles wordt bij het bouwen vooraf gemaakt (`pnpm generate`) en als statische bestanden
  // uitgerold op Cloudflare. Er draait geen server en geen database (besluit fase 4).
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/'],
    },
  },
})
