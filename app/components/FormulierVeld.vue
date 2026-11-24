<script setup lang="ts">
// Een veld van een formulier: label boven het veld, het veld zelf in de slot, en daaronder de plek voor de foutmelding
// (altijd aanwezig, voor schermlezers: `role="alert"`). De melding heeft een icoon en tekst, dus de fout is niet
// alleen aan kleur te zien. Het veld krijgt zelf `aria-invalid` en `aria-describedby` (verwijzend naar `foutId`) en
// de klasse `veld__invoer` voor de opmaak; dat doet het formulier, want het weet welk soort veld het is.
defineProps<{ id: string; foutId: string; label: string; fout?: string | null }>()
</script>

<template>
  <div class="veld">
    <!-- Het veld zelf staat in de slot (en heeft het `id`), het label hoort er dus bij via `for` -->
    <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
    <label :for="id" class="veld__etiket">
      <span class="veld__label">{{ label }}</span>
      <slot />
    </label>
    <div :id="foutId" role="alert">
      <p v-if="fout" class="veld__fout">
        <svg class="melding__icoon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="12" fill="currentColor" />
          <path d="M12 6.5v7" stroke="#fff" stroke-width="2.6" stroke-linecap="round" />
          <circle cx="12" cy="17.4" r="1.6" fill="#fff" />
        </svg>
        {{ fout }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.veld {
  display: flex;
  flex-direction: column;
}

.veld__etiket {
  display: flex;
  flex-direction: column;
}

/* 10 px tussen label en veld, zodat de focusring het label niet raakt */
.veld__label {
  margin-block-end: 0.625rem;
  font-weight: var(--gewicht-vet);
}

.veld :slotted(.veld__invoer) {
  box-sizing: border-box;
  inline-size: 100%;
  min-block-size: 3.25rem;
  padding: 0 calc(1.25rem - 1px);
  border: 1px solid var(--kleur-tekst);
  border-radius: 1.5625rem;
  background: var(--kleur-wit);
  color: var(--tekst);
  font: inherit;
  font-size: 1.1875rem;
}

.veld :slotted(.veld__invoer[aria-invalid='true']) {
  border: 2px solid var(--kleur-fout);
  padding-inline: calc(1.25rem - 2px);
}

.veld__fout {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  margin: 0.5rem 0 0;
  color: var(--kleur-fout);
  font-size: var(--tekst-klein);
  font-weight: var(--gewicht-vet);
  line-height: 1.4;
}

.melding__icoon {
  flex: none;
  inline-size: 1.25rem;
  block-size: 1.25rem;
  margin-block-start: 0.1rem;
}
</style>
