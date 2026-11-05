<script setup lang="ts">
// Handschriftregel met de kop eronder. Het handschrift valt deels over de kop, zoals op de huidige site.
// Het handschrift is een gewone regel, de kop is de echte kop (zo klopt de koppenstructuur).
defineProps<{
  accent: string
  kop?: string
  niveau?: 1 | 2
  accentKleur?: 'goud' | 'terracotta'
  normaal?: boolean
}>()
</script>

<template>
  <div class="kopblok">
    <p :class="['accent', accentKleur === 'terracotta' && 'accent--terracotta']">{{ accent }}</p>
    <component
      :is="`h${niveau ?? 2}`"
      v-if="kop"
      class="kop"
      :style="normaal ? 'text-transform: none' : undefined"
      >{{ kop }}</component
    >
  </div>
</template>
