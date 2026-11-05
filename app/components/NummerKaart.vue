<script setup lang="ts">
defineProps<{
  pad: string
  titel: string
  cover: string
}>()
</script>

<template>
  <NuxtLink :to="`${pad}/`" class="kaart">
    <NuxtImg
      class="kaart__cover"
      :src="cover"
      alt=""
      width="300"
      height="300"
      densities="x1 x2"
      loading="lazy"
    />
    <span class="kaart__titel">{{ titel }}</span>
  </NuxtLink>
</template>

<style scoped>
.kaart {
  display: block;
  color: var(--tekst);
  text-decoration: none;
}

.kaart__cover {
  display: block;
  inline-size: 100%;
  block-size: auto;
  aspect-ratio: 1;
  border-radius: var(--radius-kaart);
  object-fit: cover;
}

.kaart__titel {
  display: inline-block;
  margin-block-start: var(--ruimte-3);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

.kaart:hover .kaart__titel {
  text-decoration-thickness: 2px;
}
</style>
