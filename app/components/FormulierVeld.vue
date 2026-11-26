<script setup lang="ts">
// Een veld van een formulier: label boven het veld, het veld zelf in de slot, en daaronder de plek voor de foutmelding
// (altijd aanwezig, voor schermlezers: `role="alert"`). De melding heeft een icoon en tekst, dus de fout is niet
// alleen aan kleur te zien. Het veld krijgt zelf `aria-invalid` en `aria-describedby` (verwijzend naar `foutId`) en
// de klasse `veld__invoer` voor de opmaak; dat doet het formulier, want het weet welk soort veld het is.
// Met `hulp` staat er een hulptekst tussen het label en het veld (id `<id>-hulp`; het formulier koppelt hem met
// `aria-describedby`). Een invoer met `veld__invoer--tekstvak` (een `textarea`) is 168 px hoog.
// Met `optioneel` staat er '(optioneel)' in het label, in een rustig grijs en normaal gewicht: het hoort bij de naam van het veld.
defineProps<{
  id: string
  foutId: string
  label: string
  optioneel?: string
  hulp?: string
  fout?: string | null
}>()
</script>

<template>
  <div :class="['veld', hulp && 'veld--hulp']">
    <!-- Het veld zelf staat in de slot (en heeft het `id`), het label hoort er dus bij via `for` -->
    <template v-if="hulp">
      <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
      <label :for="id" class="veld__label veld__label--hulp">{{ label }}</label>
      <p :id="`${id}-hulp`" class="veld__hulp">{{ hulp }}</p>
      <slot />
    </template>
    <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
    <label v-else :for="id" class="veld__etiket">
      <span class="veld__label"
        >{{ label }}<span v-if="optioneel" class="veld__optioneel"> ({{ optioneel }})</span></span
      >
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
