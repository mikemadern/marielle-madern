<script setup lang="ts">
// De negen nummers van de homepage als kaarten. Een klik op het beeld zet het nummer in de grote speler
// (de ouder regelt dat); de link gaat naar de pagina met het verhaal.
export interface NummerItem {
  slug: string
  titel: string
  duur: string
  beeld: string
  youtube: string
  spotify: string
  appleMusic?: string
  regel: string
  pad: string
}

defineProps<{
  nummers: NummerItem[]
  gekozen: string
  afspeelKnop: string
  verhaalKnop: string
  duurWoord: string
}>()

defineEmits<{ kies: [slug: string] }>()
</script>

<template>
  <ul class="kaarten">
    <li v-for="nummer in nummers" :key="nummer.slug" class="kaart">
      <button
        type="button"
        class="kaart__beeldknop"
        :aria-label="`${afspeelKnop}: ${nummer.titel}`"
        :aria-current="nummer.slug === gekozen ? 'true' : undefined"
        @click="$emit('kies', nummer.slug)"
      >
        <NuxtImg
          class="kaart__beeld"
          :src="nummer.beeld"
          alt=""
          width="364"
          height="205"
          densities="x1 x2"
          loading="lazy"
        />
        <svg class="kaart__rondje" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M8 5v14l11-7z" fill="currentColor" />
        </svg>
      </button>
      <div class="kaart__tekst">
        <h3 class="kaart__titel">{{ nummer.titel }}</h3>
        <p class="kaart__duur">
          <span class="verborgen">{{ duurWoord }}</span>{{ nummer.duur }}
        </p>
        <p class="kaart__regel">{{ nummer.regel }}</p>
        <p class="kaart__link">
          <NuxtLink :to="nummer.pad" :aria-label="`${verhaalKnop} van ${nummer.titel}`">{{
            verhaalKnop
          }}</NuxtLink>
        </p>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.kaarten {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2.5rem 1.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
  text-align: start;
}

@media (max-width: 47.9375rem) {
  .kaarten {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.75rem 1rem;
  }
}

/* De knop is het hele beeld */
.kaart__beeldknop {
  position: relative;
  display: block;
  inline-size: 100%;
  padding: 0;
  border: 0;
  border-radius: 1rem;
  background: transparent;
  color: var(--kleur-wit);
  cursor: pointer;
}

/* Het nummer in de speler: een ring van 2 px met 2 px wit ertussen, ook zichtbaar op een donker beeld.
   Een schaduw in plaats van een rand: de focusring (outline) blijft zo ongemoeid. */
.kaart__beeldknop[aria-current='true'] {
  box-shadow:
    0 0 0 2px var(--achtergrond),
    0 0 0 4px var(--kleur-groen);
}

.kaart__beeldknop[aria-current='true']:focus-visible {
  outline-offset: 6px;
}

.kaart__beeld {
  display: block;
  inline-size: 100%;
  block-size: auto;
  aspect-ratio: 16 / 9;
  border-radius: 1rem;
  object-fit: cover;
}

.kaart__rondje {
  position: absolute;
  inset-block-end: 0.75rem;
  inset-inline-start: 0.75rem;
  inline-size: 2.75rem;
  block-size: 2.75rem;
  padding: 0.6875rem;
  border: 2px solid var(--kleur-wit);
  border-radius: 50%;
  background: var(--kleur-terracotta-diep);
  transition: background-color 150ms;
}

.kaart__beeldknop:hover .kaart__rondje {
  background: var(--kleur-groen);
}

.kaart__tekst {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 1rem;
  align-items: baseline;
  margin-block-start: 0.875rem;
}

.kaart__tekst p,
.kaart__tekst h3 {
  margin: 0;
}

.kaart__titel {
  font-size: var(--tekst-basis);
  font-weight: var(--gewicht-vet);
  line-height: 1.3;
}

.kaart__duur {
  font-size: var(--tekst-klein);
}

.kaart__regel,
.kaart__link {
  grid-column: 1 / -1;
  font-size: var(--tekst-klein);
  color: var(--tekst);
}

.kaart__regel {
  margin-block-start: 0.25rem;
}

.kaart__link a {
  display: inline-flex;
  align-items: center;
  min-block-size: var(--doel-min);
  color: var(--link);
  text-decoration: underline;
}

@media (max-width: 47.9375rem) {
  .kaart__tekst {
    grid-template-columns: minmax(0, 1fr);
  }

  .kaart__titel {
    font-size: 1.0625rem;
  }

  /* Op de kleine beelden raakt een rondje van 44 px de getekende titel: 36 px, het hele beeld blijft klikbaar */
  .kaart__rondje {
    inset-block-end: 0.5rem;
    inset-inline-start: 0.5rem;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    padding: 0.4375rem;
  }
}
</style>
