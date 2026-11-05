<template>
  <header class="kop">
    <div class="container kop__binnen">
      <NuxtLink to="/" class="kop__logo" aria-label="Mariëlle Madern, naar de homepage">
        <img src="/logo/mariellemadern-logo-donker.svg" alt="" width="150" height="39" />
      </NuxtLink>
      <nav aria-label="Hoofdmenu">
        <ul class="kop__menu">
          <li><NuxtLink to="/over-mij/">Over mij</NuxtLink></li>
          <li><NuxtLink to="/over-de-muziek/">Over de muziek</NuxtLink></li>
          <li><NuxtLink to="/contact/">Contact</NuxtLink></li>
        </ul>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.kop {
  padding-block: var(--ruimte-4);
}

.kop__binnen {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ruimte-4);
}

.kop__logo {
  display: inline-flex;
  min-block-size: var(--doel-min);
  align-items: center;
}

.kop__menu {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ruimte-2) var(--ruimte-5);
  margin: 0;
  padding: 0;
  list-style: none;
}

.kop__menu a {
  display: inline-flex;
  min-block-size: var(--doel-min);
  align-items: center;
  color: var(--tekst);
  text-decoration: none;
}

.kop__menu a:hover,
.kop__menu a[aria-current='page'] {
  text-decoration: underline;
  text-underline-offset: 0.3em;
}
</style>
