<script setup lang="ts">
// Hero met een stille achtergrondvideo. Voorwaarden (WCAG 2.2.2 en zuinigheid):
// - er is altijd een pauzeknop
// - bij "minder beweging" of dataverbruik beperken start de video niet
// - de video start pas als de pagina klaar is, zodat hij de eerste weergave niet vertraagt
defineProps<{ regels: { tekst: string; vet: boolean }[] }>()

const video = ref<HTMLVideoElement | null>(null)
const magVideo = ref(false)
const speelt = ref(false)

onMounted(async () => {
  const minderBeweging = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const zuinig = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    ?.saveData
  magVideo.value = !minderBeweging && !zuinig
  if (!magVideo.value) return
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
      v-if="magVideo"
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
    <div class="container hero__inhoud">
      <p class="hero__citaat">
        <template v-for="(regel, i) in regels" :key="i">
          <strong v-if="regel.vet">{{ regel.tekst }}</strong>
          <template v-else>{{ regel.tekst }}</template>
          <br v-if="i < regels.length - 1" />
        </template>
      </p>
    </div>
    <button v-if="magVideo" type="button" class="hero__pauze" @click="wissel">
      {{ speelt ? 'Pauzeer achtergrondvideo' : 'Speel achtergrondvideo af' }}
    </button>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  display: grid;
  align-items: center;
  min-block-size: min(70vh, 36rem);
  background: var(--kleur-tekst);
  color: var(--kleur-wit);
  overflow: hidden;
  text-align: center;
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

/* Donkere laag in de tekstkleur, zodat wit op elk beeld goed leesbaar blijft */
.hero__laag {
  background: var(--overlay-hero);
}

.hero__inhoud {
  position: relative;
  padding-block: var(--ruimte-9);
}

.hero__citaat {
  max-inline-size: none;
  margin: 0;
  font-size: var(--tekst-hero);
  font-weight: var(--gewicht-licht);
  line-height: 1.2;
  letter-spacing: var(--lettertekenafstand-hero);
}

.hero__citaat strong {
  font-weight: var(--gewicht-vet);
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
  background: var(--kleur-tekst);
}

.hero__pauze:focus-visible {
  outline-color: var(--kleur-wit);
}
</style>
