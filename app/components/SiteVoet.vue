<script setup lang="ts">
import { kanalen } from '~/data/kanalen'
const { data: home } = await useAsyncData('voet-home', () =>
  queryCollection('home').select('voetlijst').first(),
)
const { data: nummers } = await useAsyncData('voet-nummers', () =>
  queryCollection('nummers').select('path', 'title').all(),
)

// Volgorde van de nummers staat in content/home.yml
const lijst = computed(() =>
  (home.value?.voetlijst ?? []).flatMap((slug) => {
    const n = (nummers.value ?? []).find((x) => x.path.endsWith(`/${slug}`))
    return n ? [n] : []
  }),
)

// Het jaartal in de voet. De pagina's worden bij het bouwen gemaakt, dus 'nu' is dan de dag van de bouw: zonder
// nieuwe uitrol in januari bleef het oude jaar staan. Server en browser beginnen allebei met het bouwjaar (het
// tijdstip van de bouw staat in de gegevens van de pagina, dus geen verschil bij het laden); na het laden springt
// het naar het huidige jaar.
const bouwjaar = new Date(useNuxtApp().payload.prerenderedAt ?? Date.now()).getFullYear()
const jaar = ref(bouwjaar)
onMounted(() => {
  jaar.value = new Date().getFullYear()
})
</script>

<template>
  <footer class="voet">
    <div class="voet__binnen">
      <nav aria-labelledby="voet-snel">
        <h2 id="voet-snel" class="voet__kop">Snel naar</h2>
        <ul class="voet__lijst">
          <li><NuxtLink to="/over-mij/">Over mij</NuxtLink></li>
          <li><NuxtLink to="/over-de-muziek/">Over de muziek</NuxtLink></li>
          <li><NuxtLink to="/contact/">Contact</NuxtLink></li>
        </ul>
      </nav>

      <nav aria-labelledby="voet-muziek">
        <h2 id="voet-muziek" class="voet__kop">De muziek die ik maak</h2>
        <ul class="voet__lijst">
          <li v-for="nummer in lijst" :key="nummer.path">
            <NuxtLink :to="`${nummer.path}/`">{{ nummer.title }}</NuxtLink>
          </li>
        </ul>
      </nav>

      <div>
        <h2 class="voet__kop">Neem contact op</h2>
        <p>
          <a class="voet__mail" href="mailto:hallo@mariellemadern.nl">hallo@mariellemadern.nl</a>
        </p>
      </div>

      <nav aria-labelledby="voet-volg">
        <h2 id="voet-volg" class="voet__kop">Volg mij</h2>
        <ul class="voet__iconen">
          <li v-for="kanaal in kanalen" :key="kanaal.naam">
            <a :href="kanaal.link" :aria-label="kanaal.naam">
              <Icoon :naam="kanaal.icoon" />
            </a>
          </li>
        </ul>
      </nav>
    </div>

    <div class="voet__onder">
      <p>Copyright {{ jaar }} Mariëlle Madern - alle rechten voorbehouden</p>
      <nav aria-label="Privacy en contact">
        <NuxtLink to="/privacy/">Privacy</NuxtLink>
        <span aria-hidden="true"> • </span>
        <NuxtLink to="/contact/">Contact</NuxtLink>
      </nav>
    </div>
  </footer>
</template>

<style scoped>
.voet {
  background: var(--achtergrond-zacht);
  padding-block: 5rem 3rem;
}

.voet__binnen,
.voet__onder {
  inline-size: min(100% - 2.5rem, 68.75rem);
  margin-inline: auto;
}

.voet__binnen {
  display: grid;
  gap: 2.5rem;
}

@media (min-width: 40rem) {
  .voet__binnen {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 64rem) {
  .voet__binnen {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.voet__kop {
  margin-block-end: 0.75rem;
  font-size: 1rem;
  font-weight: 500;
}

.voet__lijst,
.voet__iconen {
  margin: 0;
  padding: 0;
  list-style: none;
}

.voet__lijst a,
.voet__mail {
  display: inline-flex;
  align-items: center;
  min-block-size: var(--doel-min);
  color: var(--tekst);
  font-weight: 400;
  text-decoration: none;
}

.voet__lijst a:hover,
.voet__mail:hover {
  text-decoration: underline;
}

/* E-mailadres in terracotta diep: het oorspronkelijke terracotta haalt 3,48:1 op crème */
.voet__mail {
  color: var(--kleur-terracotta-diep);
  text-decoration: underline;
}

.voet__iconen {
  display: flex;
  flex-wrap: wrap;
}

.voet__iconen a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: var(--doel-min);
  block-size: var(--doel-min);
  color: var(--kleur-terracotta-diep);
}

.voet__onder {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 2rem;
  margin-block-start: 3rem;
  font-size: 0.875rem;
}

.voet__onder p {
  margin: 0;
}

.voet__onder a {
  /* Klikvlak minstens 1,5rem hoog (24 px), anders is de link te klein om te raken */
  display: inline-flex;
  align-items: center;
  min-block-size: 1.5rem;
  color: var(--kleur-terracotta-diep);
}
</style>
