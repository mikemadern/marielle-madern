<script setup lang="ts">
import type { VideoItem } from '~/components/Videolijst.vue'

const { data: home } = await useAsyncData('home', () => queryCollection('home').first())
const { data: nummers } = await useAsyncData('home-nummers', () =>
  queryCollection('nummers').select('path', 'title', 'duur', 'videoBeeld', 'youtube').all(),
)

if (!home.value) {
  throw createError({ statusCode: 500, statusMessage: 'Homepage-inhoud ontbreekt', fatal: true })
}

// Volgorde van de videolijst staat in content/home.yml
const videos = computed<VideoItem[]>(() => {
  const lijst = nummers.value ?? []
  return (home.value?.videolijst ?? []).flatMap((slug) => {
    const n = lijst.find((x) => x.path.endsWith(`/${slug}`))
    return n
      ? [{ slug, titel: n.title, duur: n.duur, beeld: n.videoBeeld, youtube: n.youtube }]
      : []
  })
})

useHead({ title: home.value.seoTitel })
useSeoMeta({ description: home.value.description })
</script>

<template>
  <div v-if="home">
    <HeroVideo :regels="home.heroRegels" />

    <section class="sectie">
      <div class="container tekstblok">
        <p class="accent">{{ home.kicker }}</p>
        <h1>{{ home.slogan }}</h1>
        <p v-for="alinea in home.intro" :key="alinea">{{ alinea }}</p>
        <NuxtLink class="knop" :to="home.introKnop.link">{{ home.introKnop.tekst }}</NuxtLink>
      </div>
    </section>

    <section class="sectie sectie--zacht">
      <div class="container">
        <div class="tekstblok">
          <p class="accent">{{ home.videoKicker }}</p>
          <h2>{{ home.videoKop }}</h2>
        </div>
        <Videolijst :videos="videos" />
        <p class="tekstblok knoppen">
          <NuxtLink class="knop" :to="home.muziekKnop.link">{{ home.muziekKnop.tekst }}</NuxtLink>
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.tekstblok {
  text-align: center;
}

.tekstblok p {
  margin-inline: auto;
}

.knoppen {
  margin-block: var(--ruimte-7) 0;
}
</style>
