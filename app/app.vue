<script setup lang="ts">
// Elke pagina levert de volledige titel, zoals in documenten/inhoud/seo.md. Geen sjabloon.
useHead({ titleTemplate: '%s' })
</script>

<template>
  <div class="pagina">
    <a class="sla-over" href="#inhoud">Ga naar de inhoud</a>
    <SiteKop />
    <main id="inhoud" tabindex="-1">
      <NuxtPage />
    </main>
    <SiteVoet />
  </div>
</template>
