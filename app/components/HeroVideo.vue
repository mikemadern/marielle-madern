<script setup lang="ts">
// Hero met een stille achtergrondvideo, zoals op de huidige site.
// - Zonder voorkeur voor minder beweging speelt de video vanzelf, zonder knop (keuze van de opdrachtgever).
// - Met "minder beweging" in de browser start de video niet. Dan staat er een knop om hem te starten, en
//   daarna om hem te pauzeren. Alleen deze bezoekers zien de knop.
// - Bij "dataverbruik beperken" is er geen video.
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

.hero__video,
.hero__laag {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
}

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
  position: absolute;
  inset-block-end: var(--ruimte-4);
  inset-inline-end: var(--ruimte-4);
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
