<script setup lang="ts">
// Hero met een stille achtergrondvideo, zoals op de huidige site.
// - Zonder voorkeur voor minder beweging speelt de video vanzelf, zonder knop (keuze van de opdrachtgever).
// - Met "minder beweging" in de browser start de video niet. Dan staat er een knop om hem te starten, en
//   daarna om hem te pauzeren. Alleen deze bezoekers zien de knop.
// - Bij "dataverbruik beperken" is er geen video, alleen het stilstaande beeld.
// - De video start pas als de pagina klaar is, zodat hij de eerste weergave niet vertraagt.
defineProps<{ regels: { tekst: string; vet: boolean }[] }>()

const video = ref<HTMLVideoElement | null>(null)
const metVideo = ref(false)
const minderBeweging = ref(false)
const speelt = ref(false)

onMounted(async () => {
  minderBeweging.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const zuinig = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    ?.saveData
  metVideo.value = !zuinig
  if (!metVideo.value || minderBeweging.value) return
  // Wacht tot het video-element in de pagina staat
  await nextTick()

  const start = () => {
    video.value?.play().catch(() => {
      speelt.value = false
    })
  }
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
})

function wissel() {
  const v = video.value
  if (!v) return
  if (v.paused) v.play().catch(() => {})
  else v.pause()
}
</script>

<template>
  <section class="hero">
    <!-- Het stilstaande beeld is het eerste beeld van de video: wie geen video krijgt (minder beweging,
         dataverbruik beperken, geen JavaScript) ziet dit, en bij een video verspringt er niets. De
         breedtes horen bij scripts/afbeeldingen.mjs. -->
    <img
      class="hero__poster"
      src="/afbeeldingen/hero/poster-1280.webp"
      srcset="
        /afbeeldingen/hero/poster-384.webp   384w,
        /afbeeldingen/hero/poster-768.webp   768w,
        /afbeeldingen/hero/poster-1280.webp 1280w
      "
      sizes="(max-width: 767px) 384px, 1280px"
      alt=""
      aria-hidden="true"
      width="1920"
      height="1080"
      fetchpriority="high"
    />
    <video
      v-if="metVideo"
      ref="video"
      class="hero__video"
      muted
      loop
      playsinline
      preload="none"
      aria-hidden="true"
      tabindex="-1"
      @play="speelt = true"
      @pause="speelt = false"
    >
      <source src="/video/hero.mp4" type="video/mp4" />
    </video>
    <div class="hero__laag" />
    <p class="hero__citaat">
      <template v-for="(regel, i) in regels" :key="i">
        <strong v-if="regel.vet">{{ regel.tekst }}</strong>
        <template v-else>{{ regel.tekst }}</template>
        <br v-if="i < regels.length - 1" />
      </template>
    </p>
    <button v-if="metVideo && minderBeweging" type="button" class="hero__pauze" @click="wissel">
      {{ speelt ? 'Pauzeer achtergrondvideo' : 'Speel achtergrondvideo af' }}
    </button>
  </section>
</template>

<style scoped>
/* 600 px hoog (op mobiel 300 px), met de salie als achtergrond zoals nu */
.hero {
  position: relative;
  display: grid;
  align-items: center;
  justify-items: center;
  grid-template-rows: 1fr auto;
  min-block-size: 37.5rem;
  background: var(--kleur-salie);
  color: var(--kleur-wit);
  overflow: hidden;
  text-align: center;
}

@media (max-width: 47.9375rem) {
  .hero {
    min-block-size: 18.75rem;
    padding-block: 3rem;
  }
}

.hero__poster,
.hero__video,
.hero__laag {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
}

.hero__poster,
.hero__video {
  object-fit: cover;
}

/* Donkere laag in de tekstkleur, zodat wit op elk beeld goed leesbaar blijft (65 procent) */
.hero__laag {
  background: var(--overlay-hero);
}

.hero__citaat {
  position: relative;
  inline-size: min(100% - 2.5rem, 50rem);
  margin: 0;
  font-size: var(--tekst-hero);
  font-weight: 400;
  line-height: 1.1667;
  letter-spacing: -0.0333em;
}

.hero__citaat strong {
  font-weight: 600;
}

.hero__pauze {
  /* Onder de tekst, in de tweede rij van het raster: de hero groeit mee en de knop raakt de tekst niet */
  position: relative;
  margin-block: var(--ruimte-element) var(--ruimte-5);
  /* Bij een grote tekstgrootte of een smal scherm mag de tekst op de knop afbreken, in plaats van uit beeld te lopen */
  max-inline-size: calc(100% - 2 * var(--ruimte-5));
  text-align: center;
  min-block-size: var(--doel-min);
  padding: var(--ruimte-2) var(--ruimte-5);
  border: 2px solid var(--kleur-wit);
  border-radius: var(--radius-knop);
  background: var(--kleur-tekst);
  color: var(--kleur-wit);
  font: inherit;
  font-size: var(--tekst-klein);
  cursor: pointer;
}

.hero__pauze:hover {
  background: var(--kleur-groen);
}

.hero__pauze:focus-visible {
  outline-color: var(--kleur-wit);
}
</style>
