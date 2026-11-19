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
      class="uitgelicht__speler"
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
          <span class="uitgelicht__linktekst">{{ link.tekst }}</span>
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

/* Telefoon en tablet (tot 850 px): de knop naar het verhaal en de drie luisterlinks staan in één rij die mag
   afbreken. De drie links zijn ronde icoonknoppen van 44 px; de tekst blijft in de code (visueel verborgen),
   dus de toegankelijke naam (aria-label) blijft de volle tekst. Passen ze niet naast de knop (onder ongeveer
   380 px), dan staan ze eronder, links uitgelijnd. */
@media (max-width: 53.125rem) {
  .uitgelicht {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem 0.75rem;
  }

  .uitgelicht__speler {
    flex: 0 0 100%;
  }

  /* De rij zelf valt weg: de tekst, de knop en de links worden de onderdelen van .uitgelicht */
  .uitgelicht__rij {
    display: contents;
  }

  .uitgelicht__tekst {
    flex: 0 0 100%;
    margin-block-start: 0.5rem;
    text-align: start;
  }

  .uitgelicht__links {
    flex-wrap: nowrap;
    justify-content: flex-start;
    gap: 0.5rem;
    margin: 0;
  }

  .uitgelicht__links .knop--licht {
    inline-size: 2.75rem;
    block-size: 2.75rem;
    min-block-size: 0;
    padding: 0;
    gap: 0;
  }

  .uitgelicht__linktekst {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
</style>
