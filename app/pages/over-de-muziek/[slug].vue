<script setup lang="ts">
const route = useRoute()
const slug = String(route.params.slug)

const { data: nummer } = await useAsyncData(`nummer-${slug}`, () =>
  queryCollection('nummers').path(`/over-de-muziek/${slug}`).first(),
)

if (!nummer.value) {
  throw createError({ statusCode: 404, statusMessage: 'Nummer niet gevonden', fatal: true })
}

useSeoMeta({
  title: `${nummer.value.title}: liedtekst - Mariëlle Madern`,
  description: nummer.value.description,
})

// Strofen zijn gescheiden door een lege regel, de regels binnen een strofe blijven staan
const strofen = computed(() => nummer.value?.liedtekst.trim().split(/\n\s*\n/) ?? [])
</script>

<template>
  <article v-if="nummer">
    <header class="sectie sectie--accent">
      <div class="container">
        <h1>{{ nummer.title }}</h1>
      </div>
    </header>

    <div class="sectie">
      <div class="container nummer">
        <div class="nummer__cover">
          <NuxtImg
            :src="nummer.cover.src"
            :alt="nummer.cover.alt"
            width="384"
            height="384"
            densities="x1 x2"
          />
          <p>Duur: {{ nummer.duur }}</p>
          <ul class="nummer__links">
            <li>
              <a :href="`https://open.spotify.com/track/${nummer.spotify}`">
                Luister op Spotify: {{ nummer.title }}
              </a>
            </li>
            <li>
              <a :href="`https://youtu.be/${nummer.youtube}`">
                Bekijk op YouTube: {{ nummer.title }}
              </a>
            </li>
          </ul>
        </div>

        <div class="nummer__tekst">
          <ContentRenderer :value="nummer" />
          <h2>Liedtekst</h2>
          <p v-for="(strofe, i) in strofen" :key="i" class="strofe">{{ strofe }}</p>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.nummer {
  display: grid;
  gap: var(--ruimte-7);
}

@media (min-width: 48rem) {
  .nummer {
    grid-template-columns: minmax(0, 24rem) minmax(0, 1fr);
  }
}

.nummer__links {
  margin: 0;
  padding: 0;
  list-style: none;
}

.nummer__links a {
  display: inline-flex;
  min-block-size: var(--doel-min);
  align-items: center;
}

.strofe {
  white-space: pre-line;
}
</style>
