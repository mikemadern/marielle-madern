<script setup lang="ts">
import type { NummerItem } from '~/components/NummerKaarten.vue'

const { data: home } = await useAsyncData('home', () => queryCollection('home').first())
const { data: nummers } = await useAsyncData('home-nummers', () =>
  queryCollection('nummers')
    .select('path', 'title', 'duur', 'videoBeeld', 'youtube', 'spotify', 'appleMusic', 'kaartregel')
    .all(),
)

if (!home.value) {
  throw createError({ statusCode: 500, statusMessage: 'Homepage-inhoud ontbreekt', fatal: true })
}

// Volgorde van de kaarten staat in content/home.yml
const items = computed<NummerItem[]>(() => {
  const lijst = nummers.value ?? []
  return (home.value?.videolijst ?? []).flatMap((slug) => {
    const n = lijst.find((x) => x.path.endsWith(`/${slug}`))
    return n
      ? [
          {
            slug,
            titel: n.title,
            duur: n.duur,
            beeld: n.videoBeeld,
            youtube: n.youtube,
            spotify: n.spotify,
            appleMusic: n.appleMusic || undefined,
            regel: n.kaartregel,
            pad: `${n.path}/`,
          },
        ]
      : []
  })
})

// Het nummer in de grote speler: bij het laden het uitgelichte nummer, daarna wat de bezoeker kiest
const gekozen = ref(home.value.uitgelicht)
const huidig = computed(() => items.value.find((n) => n.slug === gekozen.value) ?? items.value[0])
// Bij het uitgelichte nummer staat zijn eigen regel, bij een ander nummer de regel van zijn kaart
const regel = computed(() =>
  gekozen.value === home.value?.uitgelicht ? home.value.uitgelichtRegel : huidig.value?.regel,
)

// Elke klik op een kaart verhoogt de teller: de speler begint dan meteen met dat nummer
const start = ref(0)
const spelerBlok = useTemplateRef<{ $el: HTMLElement }>('spelerBlok')

async function kies(slug: string) {
  gekozen.value = slug
  start.value++
  await nextTick()
  const minderBeweging = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  spelerBlok.value?.$el.scrollIntoView({
    block: 'center',
    behavior: minderBeweging ? 'auto' : 'smooth',
  })
}

useHead({ title: home.value.seoTitel })
useSeoMeta({ description: home.value.description })
</script>

<template>
  <div v-if="home">
    <HeroVideo :regels="home.heroRegels" />

    <section class="sectie sectie--eind">
      <div class="midden">
        <div class="kolom--breed">
          <KopBlok :accent="home.kicker" :kop="home.slogan" :niveau="1" />
        </div>
        <div class="kolom tekst">
          <p v-for="alinea in home.intro" :key="alinea">{{ alinea }}</p>
        </div>
        <p>
          <NuxtLink class="knop" :to="home.introKnop.link">{{ home.introKnop.tekst }}</NuxtLink>
        </p>
      </div>
    </section>

    <section aria-labelledby="luister-kop">
      <div v-if="huidig" class="luister__speler sectie--vlak">
        <div class="container midden">
          <KopBlok
            :accent="home.videoKicker"
            :kop="home.videoKop"
            accent-kleur="goudtekst"
            kop-id="luister-kop"
            normaal
          />
          <div class="luister__blok">
            <UitgelichtNummer
              ref="spelerBlok"
              :nummer="huidig"
              :regel="regel ?? ''"
              :start="start"
              :speler-noot="home.spelerNoot"
              :verhaal-knop="home.verhaalKnop"
              :luister-spotify="home.luisterSpotify"
              :luister-apple-music="home.luisterAppleMusic"
              :luister-youtube="home.luisterYoutube"
            />
          </div>
        </div>
      </div>
      <div class="sectie--vlak-krap">
        <div class="container midden">
          <NummerKaarten
            :nummers="items"
            :gekozen="gekozen"
            :afspeel-knop="home.afspeelKnop"
            :verhaal-knop="home.verhaalKnop"
            :duur-woord="home.duurWoord"
            @kies="kies"
          />
          <p class="luister__meer">
            <NuxtLink class="knop" :to="home.muziekKnop.link">{{ home.muziekKnop.tekst }}</NuxtLink>
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.luister__speler {
  background: var(--achtergrond-zacht);
}

.luister__blok {
  margin-block-start: 3.5rem;
}

.luister__meer {
  margin: 3rem 0 0;
}
</style>
