<script setup lang="ts">
const { data: pagina } = await useAsyncData('pagina-over-de-muziek', () =>
  queryCollection('paginas').path('/over-de-muziek').first(),
)
const { data: uitgave } = await useAsyncData('uitgave', () => queryCollection('uitgaven').first())
const { data: nummers } = await useAsyncData('nummers-overzicht', () =>
  queryCollection('nummers')
    .order('volgorde', 'ASC')
    .select('path', 'title', 'uitgave', 'volgorde', 'cover')
    .all(),
)

if (!pagina.value) {
  throw createError({ statusCode: 404, statusMessage: 'Pagina niet gevonden', fatal: true })
}

const ep = computed(() => (nummers.value ?? []).filter((n) => n.uitgave === 'ep'))
const singles = computed(() => (nummers.value ?? []).filter((n) => n.uitgave === 'single'))

useSeoMeta({
  title: pagina.value.seoTitel ?? pagina.value.title,
  description: pagina.value.description,
})
</script>

<template>
  <article v-if="pagina" class="sectie">
    <div class="container">
      <div class="tekst">
        <p v-if="pagina.kicker" class="accent">{{ pagina.kicker }}</p>
        <h1>{{ pagina.title }}</h1>
        <ContentRenderer :value="pagina" />
      </div>

      <section v-if="ep.length" class="blok" aria-labelledby="kop-ep">
        <p class="accent">Ontdek het verhaal achter het verhaal</p>
        <h2 id="kop-ep">Het verhaal achter mijn EP “{{ uitgave?.title }}”</h2>
        <ul class="kaarten">
          <li v-for="nummer in ep" :key="nummer.path">
            <NummerKaart :pad="nummer.path" :titel="nummer.title" :cover="nummer.cover.src" />
          </li>
        </ul>
        <p><NuxtLink class="knop" to="/bestel-de-ep/">Bestel de EP</NuxtLink></p>
      </section>

      <section v-if="singles.length" class="blok" aria-labelledby="kop-singles">
        <p class="accent">Waarom elk nummer zo bijzonder is</p>
        <h2 id="kop-singles">Het verhaal achter mijn singles</h2>
        <ul class="kaarten">
          <li v-for="nummer in singles" :key="nummer.path">
            <NummerKaart :pad="nummer.path" :titel="nummer.title" :cover="nummer.cover.src" />
          </li>
        </ul>
      </section>
    </div>
  </article>
</template>

<style scoped>
.blok {
  margin-block-start: var(--ruimte-9);
}

.kaarten {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: var(--ruimte-6);
  margin: var(--ruimte-6) 0;
  padding: 0;
  list-style: none;
}
</style>
