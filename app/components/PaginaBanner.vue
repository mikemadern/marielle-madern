<script setup lang="ts">
// Brede gekleurde kopbalk met de paginatitel en twee bladtekeningen, zoals op de huidige site.
// **tekst** in de titel wordt vet (op Contact: "Neem **contact** op").
const props = defineProps<{
  titel: string
  kleur: 'sage' | 'lichtgoud' | 'blush'
}>()

const delen = computed(() =>
  props.titel.split('**').map((tekst, i) => ({ tekst, vet: i % 2 === 1 })),
)
</script>

<template>
  <div :class="['banner', `banner--${kleur}`]">
    <span class="banner__blad banner__blad--links" aria-hidden="true" />
    <span class="banner__blad banner__blad--rechts" aria-hidden="true" />
    <h1 class="banner__titel">
      <template v-for="(deel, i) in delen" :key="i">
        <b v-if="deel.vet">{{ deel.tekst }}</b>
        <template v-else>{{ deel.tekst }}</template>
      </template>
    </h1>
  </div>
</template>
