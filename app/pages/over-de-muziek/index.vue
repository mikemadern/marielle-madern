<script setup lang="ts">
const { data: pagina } = await useAsyncData('pagina-over-de-muziek', () =>
  queryCollection('paginas').path('/over-de-muziek').first(),
)
const { data: nummers } = await useAsyncData('nummers-overzicht', () =>
  queryCollection('nummers').select('path', 'title', 'cover', 'uitgave', 'volgorde').all(),
)
// De EP: titel en de zes nummers in de volgorde van de cd staan in content/uitgaven
const { data: uitgave } = await useAsyncData('uitgave-overzicht', () =>
  queryCollection('uitgaven').first(),
)

if (!pagina.value) {
  throw createError({ statusCode: 404, statusMessage: 'Pagina niet gevonden', fatal: true })
}

// De covers van de EP, in de volgorde van de cd
const epNummers = computed(() =>
  (uitgave.value?.nummers ?? []).flatMap((slug) => {
    const n = (nummers.value ?? []).find((x) => x.path.endsWith(`/${slug}`))
    return n ? [n] : []
  }),
)

// De singles: alle nummers met uitgave: single, de nieuwste (hoogste volgorde) eerst
const singles = computed(() =>
  (nummers.value ?? [])
    .filter((n) => n.uitgave === 'single')
    .sort((a, b) => b.volgorde - a.volgorde),
)

useSeoMeta({
  title: pagina.value.seoTitel ?? pagina.value.title,
  description: pagina.value.description,
})
useDeelafbeelding('over-de-muziek', 'Over de muziek van Mariëlle Madern')

// Schema.org: de pagina is een overzicht en de lijst met nummers staat erin, in dezelfde volgorde als de covers
// (eerst de EP in de volgorde van de cd, daarna de singles, de nieuwste eerst)
const site = useSiteConfig().url
useSchemaOrg([
  defineWebPage({
    '@type': 'CollectionPage',
    mainEntity: { '@id': `${site}/over-de-muziek/#nummers` },
  }),
  defineItemList({
    '@id': `${site}/over-de-muziek/#nummers`,
    name: 'Nummers van Mariëlle Madern',
    itemListElement: [...epNummers.value, ...singles.value].map((n, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: n.title,
      url: `${site}${n.path}/`,
    })),
  }),
])
</script>

<template>
  <article v-if="pagina">
    <PaginaBanner :titel="pagina.bannerTitel ?? pagina.title" :kleur="pagina.kleur" />

    <div class="sectie">
      <div class="kolom">
        <KopBlok :accent="pagina.accent" :kop="pagina.kop" />
        <div class="tekst">
          <ContentRenderer :value="pagina" />
        </div>
      </div>
    </div>

    <section class="sectie" aria-labelledby="ep-kop">
      <div class="kolom">
        <KopBlok :accent="pagina.epAccent ?? ''" :kop="uitgave?.title" kop-id="ep-kop" normaal />
        <p v-if="pagina.epRegel">{{ pagina.epRegel }}</p>
        <ul class="covers">
          <li v-for="nummer in epNummers" :key="nummer.path">
            <NuxtLink :to="`${nummer.path}/`" :aria-label="nummer.title">
              <NuxtImg
                :src="nummer.cover.src"
                alt=""
                width="300"
                height="300"
                densities="x1 x2"
                loading="lazy"
              />
            </NuxtLink>
          </li>
        </ul>
        <p v-if="pagina.epKnop" class="ep__knop">
          <NuxtLink class="knop" :to="pagina.epKnop.link">{{ pagina.epKnop.tekst }}</NuxtLink>
        </p>
      </div>
    </section>

    <section class="sectie sectie--eind" aria-labelledby="singles-kop">
      <div class="kolom">
        <KopBlok
          :accent="pagina.singlesAccent ?? ''"
          :kop="pagina.singlesKop"
          kop-id="singles-kop"
        />
        <p v-if="pagina.singlesRegel">{{ pagina.singlesRegel }}</p>
        <ul class="covers">
          <li v-for="nummer in singles" :key="nummer.path">
            <NuxtLink :to="`${nummer.path}/`" :aria-label="nummer.title">
              <NuxtImg
                :src="nummer.cover.src"
                alt=""
                width="300"
                height="300"
                densities="x1 x2"
                loading="lazy"
              />
            </NuxtLink>
          </li>
        </ul>
      </div>
    </section>
  </article>
</template>

<style scoped>
.covers {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.25rem;
  margin: 1.25rem 0 0;
  padding: 0;
  list-style: none;
}

.ep__knop {
  margin: 2rem 0 0;
}

.covers a {
  display: block;
}

.covers img {
  display: block;
  inline-size: 100%;
  block-size: auto;
  aspect-ratio: 1;
  object-fit: cover;
}
</style>
