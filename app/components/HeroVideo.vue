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
      sizes="(max-width: 430px) 384px, (max-width: 767px) 768px, 100vw"
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
    <!-- Een ronde knop rechtsonder om de achtergrondvideo stil te zetten en weer te laten spelen (WCAG 2.2.2: beweging
         die langer dan vijf seconden duurt moet te pauzeren zijn). Voor iedereen die de video krijgt; wie 'minder
         beweging' heeft ingesteld krijgt hem stilstaand en kan hem hier starten. -->
    <button
      v-if="metVideo"
      type="button"
      class="hero__pauze"
      :aria-label="speelt ? 'Pauzeer achtergrondvideo' : 'Speel achtergrondvideo af'"
      @click="wissel"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="hero__pauze-icoon">
        <path v-if="speelt" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
        <path v-else d="M8 5v14l11-7z" fill="currentColor" />
      </svg>
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
    /* Onder meer ruimte (4,5 rem), zodat de ronde pauzeknop rechtsonder de tekst niet raakt */
    padding-block: 3rem 4.5rem;
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
  /* Rechtsonder in de hero, 44 px rond, in de stijl van de afspeelknop bij het uitgelichte nummer (terracotta diep,
     witte rand), zoals in het voorstel van de Designer */
  position: absolute;
  inset-block-end: 1rem;
  inset-inline-end: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  inline-size: var(--doel-min);
  block-size: var(--doel-min);
  padding: 0;
  border: 2px solid var(--kleur-wit);
  border-radius: 50%;
  background: var(--kleur-terracotta-diep);
  color: var(--kleur-wit);
  cursor: pointer;
}

.hero__pauze:hover {
  background: var(--kleur-groen);
}

.hero__pauze:focus-visible {
  outline-color: var(--kleur-wit);
}

.hero__pauze-icoon {
  inline-size: 1.25rem;
  block-size: 1.25rem;
}
</style>
