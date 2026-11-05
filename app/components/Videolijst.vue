<script setup lang="ts">
// De videolijst van de homepage: links de lijst, rechts de speler, zoals op de huidige site.
// YouTube laadt pas na een klik (zie VideoSpeler).
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
  <div v-if="huidig" class="lijst">
    <div class="lijst__kolom">
      <div class="lijst__kop">
        <p class="lijst__naam">Mariëlle Madern</p>
        <p class="lijst__aantal">{{ videos.length }} video’s</p>
      </div>
      <ul class="lijst__items">
        <li v-for="(video, i) in videos" :key="video.slug">
          <button
            type="button"
            class="lijst__item"
            :aria-current="i === gekozen ? 'true' : undefined"
            @click="gekozen = i"
          >
            <NuxtImg
              class="lijst__klein"
              :src="video.beeld"
              alt=""
              width="60"
              height="34"
              densities="x1 x2"
              loading="lazy"
            />
            <span class="lijst__titel">{{ video.titel }}</span>
            <span class="lijst__duur">{{ video.duur }}</span>
          </button>
        </li>
      </ul>
    </div>
    <div class="lijst__speler">
      <VideoSpeler :id="huidig.youtube" :titel="huidig.titel" :beeld="huidig.beeld" />
    </div>
  </div>
</template>

<style scoped>
.lijst {
  display: grid;
  gap: 1.25rem;
  inline-size: min(100% - 2.5rem, 62.125rem);
  margin-inline: auto;
}

@media (min-width: 60rem) {
  .lijst {
    grid-template-columns: 19rem minmax(0, 1fr);
    align-items: start;
  }
}

.lijst__kolom {
  display: flex;
  flex-direction: column;
  background: var(--kleur-creme);
  border-radius: 1rem;
  overflow: hidden;
}

.lijst__kop {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1rem 0.5rem;
  font-size: 1rem;
}

.lijst__kop p {
  margin: 0;
}

.lijst__naam {
  font-weight: 700;
}

.lijst__aantal {
  font-size: 0.875rem;
}

.lijst__items {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  padding: 0 0.5rem 0.5rem;
  max-block-size: 20rem;
  overflow-y: auto;
  list-style: none;
}

.lijst__item {
  display: grid;
  grid-template-columns: 3.75rem 1fr auto;
  align-items: center;
  gap: 0.75rem;
  inline-size: 100%;
  min-block-size: var(--doel-min);
  padding: 0.5rem;
  border: 2px solid transparent;
  border-radius: 0.75rem;
  background: transparent;
  color: var(--tekst);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  text-align: start;
  cursor: pointer;
}

.lijst__item:hover {
  background: var(--kleur-wit);
}

.lijst__item[aria-current='true'] {
  background: var(--kleur-wit);
  border-color: var(--kleur-groen);
}

.lijst__klein {
  inline-size: 100%;
  block-size: auto;
  aspect-ratio: 16 / 9;
  border-radius: 0.375rem;
  object-fit: cover;
}

.lijst__duur {
  font-size: 0.8125rem;
}
</style>
