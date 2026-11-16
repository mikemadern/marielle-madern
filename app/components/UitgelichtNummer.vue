<script setup lang="ts">
import type { NummerItem } from '~/components/NummerKaarten.vue'

// Het nummer in de grote speler, met de korte regel, de knop naar het verhaal en de luisterlinks.
// YouTube laadt pas na een klik (zie VideoSpeler).
const props = defineProps<{
  nummer: NummerItem
  regel: string
  start: number
  spelerNoot: string
  verhaalKnop: string
  luisterSpotify: string
  luisterAppleMusic: string
  luisterYoutube: string
}>()

// Is er (nog) geen Apple Music-link naar het nummer zelf, dan gaat de knop naar de artiestpagina
const APPLE_MUSIC_ARTIEST = 'https://music.apple.com/nl/artist/mari%C3%ABlle-madern/1692097525'

const luisterlinks = computed(() => {
  const { titel, spotify, youtube, appleMusic } = props.nummer
  return [
    {
      icoon: 'spotify',
      tekst: props.luisterSpotify,
      href: `https://open.spotify.com/track/${spotify}`,
      naam: `${props.luisterSpotify}: ${titel}`,
    },
    {
      icoon: 'apple',
      tekst: props.luisterAppleMusic,
      href: appleMusic ?? APPLE_MUSIC_ARTIEST,
      // De link naar de artiestpagina gaat niet naar dit nummer: dan geen titel in de naam
      naam: appleMusic ? `${props.luisterAppleMusic}: ${titel}` : props.luisterAppleMusic,
    },
    {
      icoon: 'youtube',
      tekst: props.luisterYoutube,
      href: `https://www.youtube.com/watch?v=${youtube}`,
      naam: `${props.luisterYoutube}: ${titel}`,
    },
  ] as const
})
</script>

<template>
  <div class="uitgelicht">
    <VideoSpeler
      :id="nummer.youtube"
      :titel="nummer.titel"
      :beeld="nummer.beeld"
      :noot="spelerNoot"
      :start="start"
    />
    <div class="uitgelicht__rij">
      <div class="uitgelicht__tekst">
        <h3 class="uitgelicht__titel">{{ nummer.titel }}</h3>
        <p class="uitgelicht__regel">{{ regel }}</p>
      </div>
      <NuxtLink class="knop" :to="nummer.pad">{{ verhaalKnop }}</NuxtLink>
    </div>
    <ul class="uitgelicht__links">
      <li v-for="link in luisterlinks" :key="link.icoon">
        <a class="knop knop--licht" :href="link.href" :aria-label="link.naam">
          <Icoon :naam="link.icoon" />
          {{ link.tekst }}
        </a>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.uitgelicht {
  inline-size: min(100%, 55rem);
  margin-inline: auto;
}

.uitgelicht__rij {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  margin-block-start: 1.5rem;
  text-align: start;
}

.uitgelicht__titel {
  margin: 0;
  font-size: 1.5rem;
  font-weight: var(--gewicht-vet);
  line-height: 1.2;
}

.uitgelicht__regel {
  margin: var(--ruimte-1) 0 0;
  font-size: var(--tekst-basis);
  font-weight: var(--gewicht-tekst);
}

.uitgelicht__links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
  margin: 2.5rem 0 0;
  padding: 0;
  list-style: none;
}

@media (max-width: 47.9375rem) {
  .uitgelicht__rij {
    flex-direction: column;
    align-items: flex-start;
    gap: 1.5rem;
  }

  .uitgelicht__links {
    flex-direction: column;
    align-items: center;
  }
}
</style>
