<script setup lang="ts">
// Handschriftregel met de kop eronder. Het handschrift valt deels over de kop, zoals op de huidige site.
// Het handschrift is een gewone regel, de kop is de echte kop (zo klopt de koppenstructuur).
defineProps<{
  // Zonder accent staat er alleen een kop
  accent?: string
  kop?: string
  niveau?: 1 | 2
  accentKleur?: 'goud' | 'terracotta' | 'goudtekst' | 'diep'
  normaal?: boolean
  // Het id van de kop, voor aria-labelledby van de sectie eromheen
  kopId?: string
}>()
</script>

<template>
  <div class="kopblok">
    <p
      v-if="accent"
      :class="['accent', accentKleur && accentKleur !== 'goud' && `accent--${accentKleur}`]"
    >
      {{ accent }}
    </p>
    <component
      :is="`h${niveau ?? 2}`"
      v-if="kop"
      :id="kopId"
      class="kop"
      :style="normaal ? 'text-transform: none' : undefined"
      >{{ kop }}</component
    >
  </div>
</template>
