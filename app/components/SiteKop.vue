<script setup lang="ts">
const open = ref(false)
const route = useRoute()

// Het menu klapt weer dicht na het kiezen van een pagina
watch(
  () => route.path,
  () => {
    open.value = false
  },
)

// Escape sluit het menu en zet de focus terug op de menuknop
const menuKnop = ref<HTMLButtonElement | null>(null)
function bijToets(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !open.value) return
  open.value = false
  menuKnop.value?.focus()
}

// Een tik buiten het menu sluit het ook. composedPath en niet event.target: Vue wisselt het icoon in de knop bij een
// klik, waarna het aangeklikte element al uit de pagina is en het menu meteen weer zou sluiten.
const menu = ref<HTMLElement | null>(null)
function bijKlik(e: MouseEvent) {
  if (!open.value) return
  const pad = e.composedPath()
  if (!pad.includes(menu.value as EventTarget) && !pad.includes(menuKnop.value as EventTarget)) open.value = false
}
onMounted(() => {
  document.addEventListener('keydown', bijToets)
  document.addEventListener('click', bijKlik)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', bijToets)
  document.removeEventListener('click', bijKlik)
})

const links = [
  { to: '/over-mij/', tekst: 'Over mij' },
  { to: '/over-de-muziek/', tekst: 'Over de muziek' },
  { to: '/contact/', tekst: 'Contact' },
]
</script>

<template>
  <header class="sitekop">
    <div class="sitekop__binnen">
      <NuxtLink to="/" class="sitekop__logo" aria-label="Mariëlle Madern, naar de homepage">
        <img src="/logo/mariellemadern-logo-donker.svg" alt="" width="175" height="45" />
      </NuxtLink>

      <button
        ref="menuKnop"
        type="button"
        class="sitekop__knop"
        :aria-expanded="open"
        aria-controls="hoofdmenu"
        @click="open = !open"
      >
        <span class="verborgen">Menu</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="sitekop__icoon">
          <path
            v-if="!open"
            d="M3 6h18M3 12h18M3 18h18"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            fill="none"
          />
          <path
            v-else
            d="M5 5l14 14M19 5L5 19"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            fill="none"
          />
        </svg>
      </button>

      <nav
        id="hoofdmenu"
        ref="menu"
        :class="['sitekop__menu', open && 'sitekop__menu--open']"
        aria-label="Hoofdmenu"
      >
        <ul>
          <li v-for="link in links" :key="link.to">
            <NuxtLink :to="link.to">{{ link.tekst }}</NuxtLink>
          </li>
        </ul>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.sitekop {
  position: relative;
  z-index: 2;
  block-size: var(--kop-hoogte);
  /* Effen wit, zodat de bladtekening achter het menu nooit het contrast van de menutekst beinvloedt */
  background: var(--achtergrond);
}

.sitekop__binnen {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  inline-size: min(100% - 2.5rem, 58.75rem);
  block-size: 100%;
  margin-inline: auto;
}

.sitekop__logo {
  display: inline-flex;
  align-items: center;
  min-block-size: var(--doel-min);
}

.sitekop__knop {
  display: none;
  align-items: center;
  justify-content: center;
  inline-size: var(--doel-min);
  block-size: var(--doel-min);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--tekst);
  cursor: pointer;
}

.sitekop__icoon {
  inline-size: 1.75rem;
  block-size: 1.75rem;
}

.sitekop__menu ul {
  display: flex;
  gap: 1.15rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sitekop__menu a {
  display: inline-flex;
  align-items: center;
  min-block-size: var(--doel-min);
  color: var(--tekst);
  font-weight: 400;
  text-decoration: none;
}

.sitekop__menu a:hover {
  text-decoration: underline;
  text-underline-offset: 0.3em;
}

/* De huidige pagina in goud, met een dunne gouden streep eronder (voorstel van de Designer): niet alleen de kleur
   maar ook de streep laat zien waar je bent. Goud tekst haalt 4,89:1 op wit, het oorspronkelijke goud 2,40:1 */
.sitekop__menu a.router-link-active,
.sitekop__menu a[aria-current='page'] {
  color: var(--kleur-goud-tekst);
  text-decoration: underline;
  text-decoration-color: var(--kleur-goud-tekst);
  text-decoration-thickness: 2px;
  text-underline-offset: 0.3em;
}

@media (max-width: 47.9375rem) {
  .sitekop {
    block-size: 5.1875rem;
  }

  .sitekop__knop {
    display: inline-flex;
  }

  .sitekop__menu {
    display: none;
    position: absolute;
    inset-block-start: 100%;
    inset-inline: -1.25rem;
    padding: 0.5rem 1.25rem 1rem;
    background: var(--kleur-wit);
    box-shadow: 0 0.75rem 1.5rem rgb(65 66 60 / 0.12);
  }

  .sitekop__menu--open {
    display: block;
  }

  .sitekop__menu ul {
    flex-direction: column;
    gap: 0;
  }
}
</style>
