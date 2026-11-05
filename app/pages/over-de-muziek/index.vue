<script setup lang="ts">
const { data: pagina } = await useAsyncData('pagina-over-de-muziek', () =>
  queryCollection('paginas').path('/over-de-muziek').first(),
)
const { data: nummers } = await useAsyncData('nummers-overzicht', () =>
  queryCollection('nummers').select('path', 'title', 'cover').all(),
)

if (!pagina.value) {
  throw createError({ statusCode: 404, statusMessage: 'Pagina niet gevonden', fatal: true })
}

// Volgorde van de covers staat in content/paginas/over-de-muziek.md
const lijst = computed(() =>
  (pagina.value?.nummerlijst ?? []).flatMap((slug) => {
    const n = (nummers.value ?? []).find((x) => x.path.endsWith(`/${slug}`))
    return n ? [n] : []
  }),
)

useSeoMeta({
  title: pagina.value.seoTitel ?? pagina.value.title,
  description: pagina.value.description,
})
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

    <div class="sectie sectie--eind">
      <div class="kolom">
        <KopBlok accent="Het verhaal achter mijn singles" kop="Waarom elk nummer zo bijzonder is" />
        <ul class="covers">
          <li v-for="nummer in lijst" :key="nummer.path">
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
    </div>
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
