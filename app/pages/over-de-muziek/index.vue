<script setup lang="ts">
const { data: nummers } = await useAsyncData('nummers', () =>
  queryCollection('nummers').order('volgorde', 'ASC').all(),
)

useSeoMeta({
  title: 'Over de muziek van Mariëlle Madern',
  description:
    'De muziek van Mariëlle Madern is muziek met een verhaal dat raakt, betekenis heeft en aanzet tot denken. Lees het verhaal achter elk nummer.',
})
</script>

<template>
  <article class="sectie">
    <div class="container">
      <h1>Over de muziek</h1>
      <p>Muziek met een verhaal dat raakt, betekenis heeft en aanzet tot denken.</p>
      <ul class="nummers">
        <li v-for="nummer in nummers" :key="nummer.path">
          <NuxtLink :to="`${nummer.path}/`">
            <NuxtImg
              :src="nummer.cover.src"
              alt=""
              width="300"
              height="300"
              densities="x1 x2"
              loading="lazy"
            />
            <span>{{ nummer.title }}</span>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </article>
</template>

<style scoped>
.nummers {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  gap: var(--ruimte-6);
  margin: var(--ruimte-7) 0 0;
  padding: 0;
  list-style: none;
}

.nummers a {
  display: block;
  color: var(--tekst);
}
</style>
