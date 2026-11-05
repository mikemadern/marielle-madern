<script setup lang="ts">
const route = useRoute()
const slug = String(route.params.slug)

const { data: nummer } = await useAsyncData(`nummer-${slug}`, () =>
  queryCollection('nummers').path(`/over-de-muziek/${slug}`).first(),
)
const { data: alle } = await useAsyncData('nummers-volgorde', () =>
  queryCollection('nummers').select('path', 'title', 'uitgave', 'volgorde').all(),
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

// Vorig en volgend nummer: eerst de EP, daarna de singles
const gesorteerd = computed(() =>
  [...(alle.value ?? [])].sort(
    (a, b) =>
      (a.uitgave === b.uitgave ? 0 : a.uitgave === 'ep' ? -1 : 1) || a.volgorde - b.volgorde,
  ),
)
const positie = computed(() => gesorteerd.value.findIndex((n) => n.path === nummer.value?.path))
const vorig = computed(() => gesorteerd.value[positie.value - 1])
const volgend = computed(() => gesorteerd.value[positie.value + 1])
</script>

<template>
  <article v-if="nummer">
    <header class="sectie sectie--accent">
      <div class="container">
        <nav aria-label="Kruimelpad" class="kruimel">
          <ol>
            <li><NuxtLink to="/">Home</NuxtLink></li>
            <li><NuxtLink to="/over-de-muziek/">Over de muziek</NuxtLink></li>
            <li aria-current="page">{{ nummer.title }}</li>
          </ol>
        </nav>
        <h1>{{ nummer.title }}</h1>
        <p v-if="nummer.origineel" class="origineel">
          Een bewerking van “{{ nummer.origineel.titel }}” van {{ nummer.origineel.artiest }}.
        </p>
      </div>
    </header>

    <div class="sectie">
      <div class="container nummer">
        <div class="nummer__media">
          <VideoSpeler :id="nummer.youtube" :titel="nummer.title" :beeld="nummer.videoBeeld" />
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
          <p>Duur: {{ nummer.duur }}</p>
          <NuxtImg
            class="nummer__cover"
            :src="nummer.cover.src"
            :alt="`Hoes van ${nummer.cover.alt}`"
            width="384"
            height="384"
            densities="x1 x2"
          />
        </div>

        <div class="nummer__tekst tekst">
          <ContentRenderer :value="nummer" />
          <h2>Liedtekst</h2>
          <p v-for="(strofe, i) in strofen" :key="i" class="strofe">{{ strofe }}</p>
        </div>
      </div>

      <nav class="container naast" aria-label="Andere nummers">
        <NuxtLink v-if="vorig" :to="`${vorig.path}/`" rel="prev"
          >← Vorig nummer: {{ vorig.title }}</NuxtLink
        >
        <NuxtLink v-if="volgend" :to="`${volgend.path}/`" rel="next"
          >Volgend nummer: {{ volgend.title }} →</NuxtLink
        >
      </nav>
    </div>
  </article>
</template>

<style scoped>
.kruimel ol {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ruimte-2);
  margin: 0 0 var(--ruimte-5);
  padding: 0;
  list-style: none;
  font-size: var(--tekst-klein);
}

.kruimel li + li::before {
  content: '/';
  margin-inline-end: var(--ruimte-2);
}

.kruimel a {
  color: var(--tekst);
}

.origineel {
  margin: 0;
}

.nummer {
  display: grid;
  gap: var(--ruimte-7);
}

@media (min-width: 60rem) {
  .nummer {
    grid-template-columns: minmax(0, 28rem) minmax(0, 1fr);
    align-items: start;
  }
}

.nummer__links {
  margin: var(--ruimte-4) 0;
  padding: 0;
  list-style: none;
}

.nummer__links a {
  display: inline-flex;
  min-block-size: var(--doel-min);
  align-items: center;
}

.nummer__cover {
  inline-size: 100%;
  max-inline-size: 24rem;
  block-size: auto;
  margin-block-start: var(--ruimte-5);
  border-radius: var(--radius-kaart);
}

.strofe {
  white-space: pre-line;
}

.naast {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--ruimte-4);
  margin-block-start: var(--ruimte-8);
}

.naast a {
  display: inline-flex;
  min-block-size: var(--doel-min);
  align-items: center;
}
</style>
