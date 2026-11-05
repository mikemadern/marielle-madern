<script setup lang="ts">
const { data: nummers } = await useAsyncData('voet-nummers', () =>
  queryCollection('nummers').order('title', 'ASC').select('path', 'title').all(),
)
</script>

<template>
  <footer class="voet">
    <div class="container voet__raster">
      <nav aria-label="Menu in de voet">
        <h2 class="voet__kop">Menu</h2>
        <ul class="voet__lijst">
          <li><NuxtLink to="/over-mij/">Over mij</NuxtLink></li>
          <li><NuxtLink to="/over-de-muziek/">Over de muziek</NuxtLink></li>
          <li><NuxtLink to="/bestel-de-ep/">Bestel de EP</NuxtLink></li>
          <li><NuxtLink to="/contact/">Contact</NuxtLink></li>
          <li><NuxtLink to="/privacy/">Privacyverklaring</NuxtLink></li>
        </ul>
      </nav>

      <nav aria-label="Alle nummers">
        <h2 class="voet__kop">Nummers</h2>
        <ul class="voet__lijst">
          <li v-for="nummer in nummers" :key="nummer.path">
            <NuxtLink :to="`${nummer.path}/`">{{ nummer.title }}</NuxtLink>
          </li>
        </ul>
      </nav>

      <div>
        <h2 class="voet__kop">Contact</h2>
        <p>
          <a href="mailto:hallo@mariellemadern.nl">hallo@mariellemadern.nl</a>
        </p>
        <nav aria-label="Kanalen van Mariëlle">
          <ul class="voet__lijst">
            <li><a href="https://www.youtube.com/@MarielleMadern">YouTube</a></li>
            <li><a href="https://open.spotify.com/artist/0JhC8OIE2esDeiv4Citl3j">Spotify</a></li>
            <li>
              <a href="https://music.apple.com/nl/artist/mari%C3%ABlle-madern/1692097525"
                >Apple Music</a
              >
            </li>
            <li><a href="https://www.facebook.com/marielle.overeem">Facebook</a></li>
            <li><a href="https://www.instagram.com/mariellemadern/">Instagram</a></li>
            <li><a href="https://www.linkedin.com/in/mari%C3%ABlle-madern/">LinkedIn</a></li>
          </ul>
        </nav>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.voet {
  background: var(--achtergrond-zacht);
  padding-block: var(--ruimte-8);
}

.voet__raster {
  display: grid;
  gap: var(--ruimte-7);
}

@media (min-width: 48rem) {
  .voet__raster {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.voet__kop {
  margin-block-end: var(--ruimte-3);
  font-size: 1.25rem;
}

.voet__lijst {
  margin: 0;
  padding: 0;
  list-style: none;
}

.voet a {
  display: inline-flex;
  min-block-size: var(--doel-min);
  align-items: center;
}
</style>
