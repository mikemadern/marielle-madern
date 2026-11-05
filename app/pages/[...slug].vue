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
  <article v-if="pagina" class="sectie">
    <div class="container">
      <div class="tekst">
        <p v-if="pagina.kicker" class="accent">{{ pagina.kicker }}</p>
        <h1>{{ pagina.title }}</h1>
        <ContentRenderer :value="pagina" />
      </div>
      <EpNummers v-if="pagina.path === '/bestel-de-ep'" />
    </div>
  </article>
</template>
