<script setup lang="ts">
// YouTube pas laden na een klik (privacy en snelheid). Het voorbeeldbeeld staat op onze eigen server.
// `start` is een teller: verhoogt de ouder hem, dan begint de video van het getoonde nummer meteen
// (een klik op een nummerkaart is de toestemming om YouTube te laden).
const props = defineProps<{
  id: string
  titel: string
  beeld: string
  noot: string
  start?: number
}>()

const speelt = ref(false)
const iframe = ref<HTMLIFrameElement | null>(null)

async function begin() {
  speelt.value = true
  // De knop verdwijnt zodra de video start: zet de focus op de video, anders raakt het toetsenbord kwijt
  await nextTick()
  iframe.value?.focus({ preventScroll: true })
}

// Een ander nummer zet de speler terug naar het voorbeeldbeeld, tenzij de ouder ook de startteller
// heeft verhoogd: dan begint dat nummer meteen.
watch(
  () => [props.id, props.start] as const,
  ([, nu], [, voor]) => {
    if (nu !== voor) begin()
    else speelt.value = false
  },
)

const adres = computed(() => `https://www.youtube-nocookie.com/embed/${props.id}?autoplay=1&rel=0`)
</script>

<template>
  <div class="speler">
    <div class="speler__kader">
      <iframe
        v-if="speelt"
        ref="iframe"
        class="speler__iframe"
        :src="adres"
        :title="`Video: ${titel}`"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"
      />
      <template v-else>
        <NuxtImg
          class="speler__beeld"
          :src="beeld"
          alt=""
          width="880"
          height="495"
          sizes="384px md:880px"
          loading="lazy"
        />
        <button type="button" class="speler__knop" @click="begin">
          <svg class="speler__icoon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
          <span class="verborgen">Speel video af: {{ titel }}</span>
        </button>
      </template>
    </div>
    <p class="speler__noot">{{ noot }}</p>
  </div>
</template>

<style scoped>
/* De hoeken zitten op de onderdelen zelf, niet op het kader: zo snijdt het kader de focusring niet af */
.speler__kader {
  position: relative;
  aspect-ratio: 16 / 9;
}

.speler__beeld,
.speler__iframe,
.speler__knop {
  border-radius: var(--radius-kaart);
}

.speler__beeld,
.speler__iframe {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  border: 0;
  object-fit: cover;
}

.speler__iframe {
  background: var(--kleur-tekst);
}

/* De knop beslaat het hele beeld (groot klikvlak), het rondje staat linksonder */
.speler__knop {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  inline-size: 100%;
  padding: 1.25rem;
  border: 0;
  background: transparent;
  color: var(--kleur-wit);
  cursor: pointer;
}

.speler__icoon {
  inline-size: 4rem;
  block-size: 4rem;
  padding: 1rem;
  border-radius: 50%;
  background: var(--kleur-terracotta-diep);
  border: 2px solid var(--kleur-wit);
  transition:
    background-color 100ms,
    scale 100ms;
}

.speler__knop:hover .speler__icoon {
  background: var(--kleur-groen);
}

/* Ingedrukt: groen diep, en zonder 'minder beweging' 6% kleiner */
.speler__knop:active .speler__icoon {
  background: var(--kleur-groen-diep);
}

@media (prefers-reduced-motion: no-preference) {
  .speler__knop:active .speler__icoon {
    scale: 0.94;
  }
}

@media (max-width: 47.9375rem) {
  .speler__knop {
    padding: 1rem;
  }

  .speler__icoon {
    inline-size: 3.5rem;
    block-size: 3.5rem;
    padding: 0.875rem;
  }
}

.speler__noot {
  margin-block: var(--ruimte-2) 0;
  font-size: var(--tekst-klein);
}
</style>
