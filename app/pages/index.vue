<script setup lang="ts">
useHead({
  title: 'Mariëlle Madern - oprechte en authentieke aanbidding',
  titleTemplate: '%s',
})
useSeoMeta({
  description:
    'Laat je raken door de oprechte en authentieke aanbidding van Mariëlle Madern. Nederlandstalige christelijke muziek die je raakt en tot rust brengt.',
})
</script>

<template>
  <div>
    <section class="hero">
      <div class="container">
        <!-- De liedregel is geen kop: de h1 staat hieronder (zie documenten/inhoud/seo.md) -->
        <p class="hero__citaat">
          Ik geef me aan U over<br />
          <strong>want U bent zoveel groter</strong><br />
          dan wat ik denk
        </p>
      </div>
    </section>

    <section class="sectie">
      <div class="container tekstblok">
        <p class="accent" aria-hidden="true">Laat je raken</p>
        <h1>Door oprechte en authentieke aanbidding</h1>
        <p>Ik hoop dat je geraakt wordt op een nieuwe manier.</p>
        <p>
          Als mijn muziek je bij mag staan, je mee mag nemen in de rust en je zo in verbinding mag
          brengen met God, dan is het mij gelukt om muziek te maken zoals ik dat graag wil.
        </p>
        <NuxtLink class="knop" to="/over-mij/">Meer over mij</NuxtLink>
      </div>
    </section>

    <section class="sectie sectie--zacht">
      <div class="container tekstblok">
        <h2>Hoe Hij spreekt door muziek heen</h2>
        <NuxtLink class="knop" to="/over-de-muziek/">Over mijn muziek</NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero {
  background: var(--kleur-tekst);
  color: var(--kleur-wit);
  padding-block: var(--ruimte-9);
  text-align: center;
}

.hero__citaat {
  max-width: none;
  margin: 0;
  font-size: var(--tekst-hero);
  font-weight: var(--gewicht-licht);
  line-height: 1.2;
  letter-spacing: var(--lettertekenafstand-hero);
}

.hero__citaat strong {
  font-weight: var(--gewicht-vet);
}

.tekstblok {
  text-align: center;
}

.tekstblok p {
  margin-inline: auto;
}

.accent {
  font-family: var(--font-accent);
  font-size: var(--tekst-accent);
  line-height: var(--regelhoogte-accent);
  color: var(--kleur-goud-groot);
  margin-block-end: var(--ruimte-2);
}
</style>
