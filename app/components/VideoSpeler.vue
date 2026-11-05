<script setup lang="ts">
// YouTube pas laden na een klik (privacy en snelheid). Het voorbeeldbeeld staat op onze eigen server.
const props = defineProps<{
  id: string
  titel: string
  beeld: string
}>()

const speelt = ref(false)

// Een andere video kiezen zet de speler terug naar het voorbeeldbeeld
watch(
  () => props.id,
  () => {
    speelt.value = false
  },
)

const adres = computed(() => `https://www.youtube-nocookie.com/embed/${props.id}?autoplay=1&rel=0`)
</script>

<template>
  <div class="speler">
    <div class="speler__kader">
      <iframe
        v-if="speelt"
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
          width="640"
          height="360"
          densities="x1 x2"
          loading="lazy"
        />
        <button type="button" class="speler__knop" @click="speelt = true">
          <svg class="speler__icoon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
          <span class="verborgen">Speel video af: {{ titel }}</span>
        </button>
      </template>
    </div>
    <p class="speler__noot">De video wordt pas van YouTube geladen als je hem afspeelt.</p>
  </div>
</template>

<style scoped>
.speler__kader {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--kleur-tekst);
  border-radius: var(--radius-kaart);
  overflow: hidden;
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

.speler__knop {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  inline-size: 100%;
  border: 0;
  background: transparent;
  color: var(--kleur-wit);
  cursor: pointer;
}

.speler__icoon {
  inline-size: 4.5rem;
  block-size: 4.5rem;
  padding: 1rem;
  border-radius: 50%;
  background: var(--overlay-hero);
  border: 2px solid var(--kleur-wit);
}

.speler__knop:hover .speler__icoon {
  background: var(--kleur-terracotta-diep);
}

.speler__knop:focus-visible {
  outline-offset: -0.5rem;
}

.speler__noot {
  margin-block: var(--ruimte-2) 0;
  font-size: var(--tekst-klein);
}
</style>
