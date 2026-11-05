<script setup lang="ts">
// Vaste pagina's uit content/paginas: over-mij, contact, bestel-de-ep, privacy
const route = useRoute()
const pad = route.path.replace(/\/$/, '') || '/'

const { data: pagina } = await useAsyncData(`pagina-${pad}`, () =>
  queryCollection('paginas').path(pad).first(),
)

if (!pagina.value) {
  throw createError({ statusCode: 404, statusMessage: 'Pagina niet gevonden', fatal: true })
}

useSeoMeta({
  title: pagina.value.seoTitel ?? pagina.value.title,
  description: pagina.value.description,
})
</script>

<template>
  <article v-if="pagina">
    <PaginaBanner :titel="pagina.bannerTitel ?? pagina.title" :kleur="pagina.kleur" />
    <div class="sectie sectie--eind">
      <div :class="['kolom', pagina.midden && 'midden']">
        <KopBlok :accent="pagina.accent" :kop="pagina.kop" :accent-kleur="pagina.accentKleur" />
        <div class="tekst">
          <ContentRenderer :value="pagina" />
        </div>
        <p v-if="pagina.knop">
          <a class="knop" :href="pagina.knop.link">{{ pagina.knop.tekst }}</a>
        </p>
      </div>
      <EpNummers v-if="pagina.path === '/bestel-de-ep'" />
    </div>
  </article>
</template>
