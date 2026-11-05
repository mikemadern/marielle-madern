<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const isNietGevonden = computed(() => props.error.statusCode === 404)
const titel = computed(() =>
  isNietGevonden.value ? 'Pagina niet gevonden' : 'Er is iets misgegaan',
)

useHead({ title: () => `${titel.value} - Mariëlle Madern` })
useSeoMeta({ robots: 'noindex, nofollow' })
</script>

<template>
  <div class="pagina">
    <a class="sla-over" href="#inhoud">Ga naar de inhoud</a>
    <SiteKop />
    <main id="inhoud" tabindex="-1">
      <PaginaBanner :titel="titel" kleur="sage" />
      <section class="sectie sectie--eind">
        <div class="kolom">
          <p v-if="isNietGevonden">
            Deze pagina bestaat niet (meer). Misschien is het adres veranderd of is er een typfout
            gemaakt.
          </p>
          <p v-else>Probeer het later nog eens.</p>
          <p><NuxtLink class="knop" to="/">Naar de homepage</NuxtLink></p>
          <p><NuxtLink to="/over-de-muziek/">Of lees het verhaal achter de muziek</NuxtLink></p>
        </div>
      </section>
    </main>
    <SiteVoet />
  </div>
</template>
