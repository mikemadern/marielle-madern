<script setup lang="ts">
// "Nummers op de EP" onder de bestelinformatie, zoals op de huidige site: elk nummer in een crème balk.
const { data: uitgave } = await useAsyncData('uitgave-ep', () =>
  queryCollection('uitgaven').first(),
)
const { data: nummers } = await useAsyncData('ep-nummers', () =>
  queryCollection('nummers').select('path', 'title').all(),
)

const tracks = computed(() =>
  (uitgave.value?.nummers ?? []).flatMap((slug) => {
    const n = (nummers.value ?? []).find((x) => x.path.endsWith(`/${slug}`))
    return n ? [n] : []
  }),
)

// Schema.org: de EP met de nummers die op deze pagina staan. Geen Product of Offer: het is geen webshop.
const site = useSiteConfig().url
if (uitgave.value) {
  useSchemaOrg([
    defineMusicAlbum({
      '@id': `${site}/bestel-de-ep/#ep`,
      name: uitgave.value.title,
      url: `${site}/bestel-de-ep/`,
      inLanguage: 'nl',
      albumProductionType: 'https://schema.org/EPRelease',
      image: `${site}/afbeeldingen/${uitgave.value.cover.replace(/^\//, '').replace(/\.[^./]+$/, '')}-600.webp`,
      byArtist: { '@id': `${site}/#identity` },
      numTracks: tracks.value.length,
      track: tracks.value.map((t, i) => ({
        '@type': 'MusicRecording',
        position: i + 1,
        name: t.title,
        url: `${site}${t.path}/`,
      })),
    }),
  ])
}
</script>

<template>
  <section v-if="uitgave" class="sectie">
    <div class="kolom">
      <div class="midden">
        <KopBlok accent="Nummers op de EP" kop="met instrumentale versies" />
        <p>{{ uitgave.extraTekst }}</p>
      </div>
      <ul class="ep">
        <li v-for="nummer in tracks" :key="nummer.path" class="ep__rij">
          <Icoon naam="apple" class="ep__noot" />
          <NuxtLink :to="`${nummer.path}/`" class="ep__titel">{{ nummer.title }}</NuxtLink>
        </li>
        <li v-for="extra in uitgave.extra" :key="extra" class="ep__rij">
          <Icoon naam="apple" class="ep__noot" />
          <span class="ep__titel">{{ extra }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.ep {
  display: grid;
  gap: 1.1875rem;
  margin: 2rem 0 0;
  padding: 0;
  list-style: none;
}

.ep__rij {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  min-block-size: 3.8125rem;
  padding-inline: 1.5rem;
  border-radius: 3.125rem;
  background: var(--kleur-creme);
}

/* De noot is versiering. Goud mag hier, want het is geen tekst. */
.ep__noot {
  flex: none;
  inline-size: 1.5rem;
  block-size: 1.5rem;
  color: var(--kleur-goud);
}

.ep__titel {
  font-size: 1.425rem;
  font-weight: 700;
  color: var(--tekst);
  text-decoration: none;
}

a.ep__titel {
  /* De link is 44 px hoog om aan te raken (de rij eromheen is hoger, dus de indeling blijft gelijk) */
  display: inline-flex;
  align-items: center;
  min-block-size: var(--doel-min);
}

a.ep__titel:hover {
  text-decoration: underline;
}
</style>
