<script setup lang="ts">
// Een melding in een formulier: `fout` (rode rand, uitroepteken) of `goed` (groene rand, vinkje), met de tekst in de
// slot. Voor het plaatsen van `role`, `tabindex` en `ref` is het formulier zelf verantwoordelijk (ze vallen door naar
// de buitenste `div`).
defineProps<{ soort: 'fout' | 'goed' }>()
</script>

<template>
  <div :class="['melding', `melding--${soort}`]">
    <svg
      v-if="soort === 'goed'"
      class="melding__icoon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10.8" fill="none" stroke="currentColor" stroke-width="2.4" />
      <path
        d="M7 12.4l3.6 3.6 6.4-7"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <svg v-else class="melding__icoon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="12" fill="currentColor" />
      <path d="M12 6.5v7" stroke="#fff" stroke-width="2.6" stroke-linecap="round" />
      <circle cx="12" cy="17.4" r="1.6" fill="#fff" />
    </svg>
    <slot />
  </div>
</template>
