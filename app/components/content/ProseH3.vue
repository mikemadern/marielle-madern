<script setup lang="ts">
// Kop uit Markdown zonder ankerlink in de kop. Nuxt Content maakt die standaard van elke kop een link,
// wat voor schermlezers en toetsenbordgebruikers een extra, onnodige stop is.
defineProps<{ id?: string }>()
</script>

<template>
  <h3 :id="id">
    <slot />
  </h3>
</template>
