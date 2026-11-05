<script setup lang="ts">
// Nummers op de EP, onder de bestelinformatie
const { data: uitgave } = await useAsyncData('uitgave-ep', () =>
  queryCollection('uitgaven').first(),
)
const { data: nummers } = await useAsyncData('ep-nummers', () =>
  queryCollection('nummers')
    .where('uitgave', '=', 'ep')
    .order('volgorde', 'ASC')
    .select('path', 'title')
    .all(),
)
</script>

<template>
  <section v-if="uitgave" class="ep">
    <NuxtImg
      class="ep__cover"
      :src="uitgave.cover"
      :alt="`Hoes van de EP ${uitgave.title}`"
      width="384"
      height="384"
      densities="x1 x2"
    />
    <div>
      <h2>Nummers op de EP</h2>
      <ol class="ep__lijst">
        <li v-for="nummer in nummers" :key="nummer.path">
          <NuxtLink :to="`${nummer.path}/`">{{ nummer.title }}</NuxtLink>
        </li>
        <li v-for="extra in uitgave.extra" :key="extra">{{ extra }}</li>
      </ol>
      <p>{{ uitgave.extraTekst }}</p>
    </div>
  </section>
</template>

<style scoped>
.ep {
  display: grid;
  gap: var(--ruimte-6);
  margin-block-start: var(--ruimte-8);
}

@media (min-width: 48rem) {
  .ep {
    grid-template-columns: minmax(0, 24rem) minmax(0, 1fr);
    align-items: start;
  }
}

.ep__cover {
  inline-size: 100%;
  block-size: auto;
  border-radius: var(--radius-kaart);
}

.ep__lijst {
  padding-inline-start: 1.5rem;
}
</style>
