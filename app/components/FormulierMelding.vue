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

<style scoped>
.melding {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 1rem 1.25rem;
  border-radius: 0.5rem;
  background: var(--kleur-wit);
}

.melding :slotted(p) {
  margin: 0;
  overflow-wrap: anywhere;
}

.melding :slotted(a) {
  color: var(--link);
  text-underline-offset: 0.15em;
}

.melding__icoon {
  flex: none;
  inline-size: 1.25rem;
  block-size: 1.25rem;
  margin-block-start: 0.1rem;
}

.melding--fout {
  border: 1px solid var(--kleur-fout);
  border-inline-start-width: 6px;
  color: var(--tekst);
}

.melding--fout .melding__icoon {
  color: var(--kleur-fout);
}

.melding--goed {
  border: 1px solid var(--kleur-groen);
  border-inline-start-width: 6px;
  color: var(--tekst);
}

.melding--goed .melding__icoon {
  color: var(--kleur-groen);
}

.melding--goed:focus {
  outline: none;
}

.melding--goed:focus-visible {
  outline: var(--focus-breedte) solid var(--focus-kleur);
  outline-offset: var(--focus-afstand);
}

.melding :slotted(.melding__kop) {
  font-weight: var(--gewicht-vet);
}
</style>
