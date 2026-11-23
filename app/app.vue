<script setup lang="ts">
// Elke pagina levert de volledige titel, zoals in documenten/inhoud/seo.md. Geen sjabloon.
useHead({ titleTemplate: '%s' })

// Het stylesheet van Adobe Fonts (kit bxn6xtn, mae-variable) laadt niet-blokkerend: media="print" tot het geladen is,
// zodat de eerste weergave niet wacht op de servers van Adobe (tot het lettertype er is, staat de tekst in de
// terugletter uit basis.css). Het zet zichzelf op 'all' via onload (voor het laden van de pagina) en daarna via de
// reactieve waarde hieronder. Dat tweede is nodig omdat Nuxt de kop bijhoudt en `media` anders terugzet naar
// 'print' bij het laden van de pagina en bij elke wissel van pagina (dan valt het lettertype weg).
const adobeMedia = ref('print')
onMounted(() => {
  adobeMedia.value = 'all'
})
useHead({
  link: [
    {
      rel: 'stylesheet',
      href: 'https://use.typekit.net/bxn6xtn.css',
      media: adobeMedia,
      onload: "this.media='all'",
    },
  ],
})
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
