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
      <div class="midden">
        <div class="kolom--breed">
          <KopBlok :accent="home.kicker" :kop="home.slogan" :niveau="1" />
        </div>
        <div class="kolom tekst">
          <p v-for="alinea in home.intro" :key="alinea">{{ alinea }}</p>
        </div>
        <p>
          <NuxtLink class="knop" :to="home.introKnop.link">{{ home.introKnop.tekst }}</NuxtLink>
        </p>
      </div>
    </section>

    <section class="sectie sectie--eind">
      <div class="midden">
        <KopBlok :accent="home.videoKicker" :kop="home.videoKop" normaal />
        <div class="videos">
          <Videolijst :videos="videos" />
        </div>
        <div class="knoppen">
          <NuxtLink class="knop" :to="home.muziekKnop.link">{{ home.muziekKnop.tekst }}</NuxtLink>
          <ul class="kanalen">
            <li>
              <a href="https://www.youtube.com/@MarielleMadern" aria-label="YouTube"
                ><Icoon naam="youtube"
              /></a>
            </li>
            <li>
              <a href="https://open.spotify.com/artist/0JhC8OIE2esDeiv4Citl3j" aria-label="Spotify"
                ><Icoon naam="spotify"
              /></a>
            </li>
            <li>
              <a
                href="https://music.apple.com/nl/artist/mari%C3%ABlle-madern/1692097525"
                aria-label="Apple Music"
                ><Icoon naam="apple"
              /></a>
            </li>
          </ul>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.videos {
  margin-block-start: 3.5rem;
}

.knoppen {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 1rem 1.5rem;
  margin-block-start: 2rem;
  padding-inline: 1.25rem;
}

.kanalen {
  display: flex;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.kanalen a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: var(--doel-min);
  block-size: var(--doel-min);
  color: var(--kleur-terracotta-diep);
}
</style>
