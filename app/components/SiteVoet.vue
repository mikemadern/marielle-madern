<template>
  <footer class="voet">
    <div class="container">
      <p>
        <a href="mailto:hallo@mariellemadern.nl">hallo@mariellemadern.nl</a>
      </p>
      <nav aria-label="Kanalen van Mariëlle">
        <ul class="voet__kanalen">
          <li><a href="https://www.youtube.com/@MarielleMadern">YouTube</a></li>
          <li><a href="https://open.spotify.com/artist/0JhC8OIE2esDeiv4Citl3j">Spotify</a></li>
          <li>
            <a href="https://music.apple.com/nl/artist/mari%C3%ABlle-madern/1692097525"
              >Apple Music</a
            >
          </li>
        </ul>
      </nav>
      <p><NuxtLink to="/privacy/">Privacyverklaring</NuxtLink></p>
    </div>
  </footer>
</template>

<style scoped>
.voet {
  background: var(--achtergrond-zacht);
  padding-block: var(--ruimte-7);
}

.voet__kanalen {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ruimte-2) var(--ruimte-5);
  margin: 0 0 var(--ruimte-element);
  padding: 0;
  list-style: none;
}

.voet__kanalen a,
.voet a {
  display: inline-flex;
  min-block-size: var(--doel-min);
  align-items: center;
}
</style>
