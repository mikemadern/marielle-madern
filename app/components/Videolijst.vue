<script setup lang="ts">
// Videolijst voor de homepage: één speler en een lijst met alle video's
export interface VideoItem {
  slug: string
  titel: string
  duur: string
  beeld: string
  youtube: string
}

const props = defineProps<{ videos: VideoItem[] }>()

const gekozen = ref(0)
const huidig = computed(() => props.videos[gekozen.value])
</script>

<template>
  <div v-if="huidig" class="videolijst">
    <div class="videolijst__speler">
      <VideoSpeler :id="huidig.youtube" :titel="huidig.titel" :beeld="huidig.beeld" />
      <p class="videolijst__titel">{{ huidig.titel }}</p>
    </div>
    <ul class="videolijst__lijst">
      <li v-for="(video, i) in videos" :key="video.slug">
        <button
          type="button"
          class="videolijst__item"
          :aria-current="i === gekozen ? 'true' : undefined"
          @click="gekozen = i"
        >
          <NuxtImg
            class="videolijst__klein"
            :src="video.beeld"
            alt=""
            width="120"
            height="68"
            densities="x1 x2"
            loading="lazy"
          />
          <span class="videolijst__naam">{{ video.titel }}</span>
          <span class="videolijst__duur">{{ video.duur }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.videolijst {
  display: grid;
  gap: var(--ruimte-6);
  text-align: start;
}

@media (min-width: 60rem) {
  .videolijst {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    align-items: start;
  }
}

.videolijst__titel {
  margin-block: var(--ruimte-3) 0;
  font-weight: var(--gewicht-vet);
}

.videolijst__lijst {
  display: grid;
  gap: var(--ruimte-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.videolijst__item {
  display: grid;
  grid-template-columns: 7.5rem 1fr auto;
  align-items: center;
  gap: var(--ruimte-3);
  inline-size: 100%;
  min-block-size: var(--doel-min);
  padding: var(--ruimte-2);
  border: 2px solid transparent;
  border-radius: 1rem;
  background: var(--kleur-wit);
  color: var(--tekst);
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.videolijst__item:hover {
  background: var(--kleur-blush);
}

.videolijst__item[aria-current='true'] {
  border-color: var(--kleur-groen);
}

.videolijst__klein {
  inline-size: 100%;
  block-size: auto;
  border-radius: 0.5rem;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.videolijst__duur {
  font-size: var(--tekst-klein);
}
</style>
