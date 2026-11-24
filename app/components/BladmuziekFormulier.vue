<script setup lang="ts">
// Het formulier om de bladmuziek van een nummer per e-mail te vragen (design/bladmuziek-formulier.md).
// Het verstuurt naar POST /api/bladmuziek (worker/bladmuziek.mjs). Er wordt niets in de browser bewaard:
// naam en adres staan alleen in de velden en in dat ene verzoek.
//
// Cloudflare Turnstile laadt pas als het formulier wordt gebruikt (focus in het formulier of een klik op de
// koppeling erheen), zoals de YouTube-speler pas na een klik laadt. De actie `bladmuziek` hoort bij de controle
// in de Worker. Het laden van Turnstile (`useTurnstile`) en het versturen met de toestanden van het formulier
// (`useFormulierVerzending`) zijn gedeeld met de andere formulieren van de site.
import { MAIL, TEKSTEN } from '~/bladmuziek-teksten'

const props = defineProps<{ nummer: string; titel: string }>()

const T = TEKSTEN
const F = TEKSTEN.fouten

type Fout = 'naamLeeg' | 'emailLeeg' | 'emailOngeldig'

const naam = ref('')
const email = ref('')
const nieuwsbrief = ref(false)
const website = ref('') // verborgen veld tegen spam: een mens vult het niet in
// Pas na het laden van de pagina (hydratatie) kan het formulier worden gebruikt; tot dan staan de velden uit.
// Zonder JavaScript of voor het laden kan er dus niets worden verstuurd, ook niet als GET met naam en adres in het adres.
const gereed = ref(false)
const naamFout = ref<Fout | null>(null)
const emailFout = ref<Fout | null>(null)

const naamVeld = ref<HTMLInputElement | null>(null)
const emailVeld = ref<HTMLInputElement | null>(null)
const bevestiging = ref<HTMLElement | null>(null)
const widgetPlek = ref<HTMLElement | null>(null)
const valVeld = ref<HTMLInputElement | null>(null)

const uitlegId = 'bladmuziek-uitleg'

const { controleOpen, laad, krijgToken, nieuwToken, ruimOp } = useTurnstile({
  actie: 'bladmuziek',
  plek: widgetPlek,
})

// De koppeling bij de luisterbalk roept dit aan: laden, zodat het widget klaar is als het formulier in beeld is
defineExpose({ laad })

onMounted(() => {
  gereed.value = true
  if (location.hash === '#bladmuziek') void laad()
})

const EMAIL_REGEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Een melding bij een veld verdwijnt zodra het veld klopt (niet bij elke toetsaanslag een nieuwe fout tonen)
watch(naam, (v) => {
  if (naamFout.value && v.trim()) naamFout.value = null
})
watch(email, (v) => {
  if (emailFout.value && EMAIL_REGEL.test(v.trim())) emailFout.value = null
})

function controleer(): boolean {
  const n = naam.value.replace(/\s+/g, ' ').trim()
  const e = email.value.trim()
  naamFout.value = n ? null : 'naamLeeg'
  emailFout.value = !e ? 'emailLeeg' : EMAIL_REGEL.test(e) ? null : 'emailOngeldig'
  return !naamFout.value && !emailFout.value
}

async function naarEersteFout() {
  await nextTick()
  if (naamFout.value) naamVeld.value?.focus()
  else if (emailFout.value) emailVeld.value?.focus()
}

const { bezig, klaar, melding, verstuur } = useFormulierVerzending({
  pad: '/api/bladmuziek',
  turnstile: { krijgToken, nieuwToken, ruimOp },
  valVeld,
  website,
  bevestiging,
  valideer: controleer,
  naarEersteFout,
  body: (token, val) => ({
    naam: naam.value,
    email: email.value,
    nieuwsbrief: nieuwsbrief.value,
    nummer: props.nummer,
    token,
    website: val,
  }),
  // De server keurde de naam of het adres af: de fout staat dan bij dat veld
  serverVeldFout: (veld) => {
    if (veld === 'naam') naamFout.value = 'naamLeeg'
    else if (veld === 'email') emailFout.value = 'emailOngeldig'
    else return false
    return true
  },
})
</script>

<template>
  <section id="bladmuziek" class="bladmuziek" aria-labelledby="bladmuziek-kop">
    <KopBlok :kop="T.kop" kop-id="bladmuziek-kop" />

    <div v-if="klaar" class="kaart">
      <FormulierMelding ref="bevestiging" soort="goed" role="status" tabindex="-1">
        <div>
          <p class="melding__kop">{{ T.bevestigingKop }}</p>
          <p>{{ T.bevestiging }}</p>
        </div>
      </FormulierMelding>
    </div>

    <form
      v-else
      class="kaart"
      method="post"
      action="/api/bladmuziek"
      novalidate
      @submit.prevent="verstuur"
      @focusin="laad"
    >
      <p class="kaart__regel">{{ T.regel }}</p>
      <!-- Alleen tekst in noscript (geen elementen): anders klopt de hydratatie niet met wat de browser ziet -->
      <noscript class="kaart__regel">{{ T.zonderScript }}{{ MAIL }}{{ T.zonderScriptNa }}</noscript>
      <!-- Laadt het script niet (storing, geblokkeerd bestand), dan staat er een formulier dat niets doet: na een
           paar seconden verschijnt dan dezelfde uitleg (alleen CSS, zonder script, dus geen hydratatieverschil).
           Is de pagina geladen, dan verdwijnt deze regel. -->
      <p v-if="!gereed" class="kaart__regel zonder-script">
        {{ T.zonderScript }}{{ MAIL }}{{ T.zonderScriptNa }}
      </p>

      <FormulierVeld
        id="bladmuziek-naam"
        fout-id="bladmuziek-naam-fout"
        :label="T.naam"
        :fout="naamFout ? F[naamFout] : null"
      >
        <input
          id="bladmuziek-naam"
          ref="naamVeld"
          v-model="naam"
          class="veld__invoer"
          type="text"
          name="naam"
          autocomplete="name"
          enterkeyhint="next"
          maxlength="100"
          required
          :disabled="!gereed"
          :aria-invalid="naamFout ? 'true' : 'false'"
          :aria-describedby="naamFout ? 'bladmuziek-naam-fout' : undefined"
        />
      </FormulierVeld>

      <FormulierVeld
        id="bladmuziek-email"
        fout-id="bladmuziek-email-fout"
        :label="T.email"
        :fout="emailFout ? F[emailFout] : null"
      >
        <input
          id="bladmuziek-email"
          ref="emailVeld"
          v-model="email"
          class="veld__invoer"
          type="email"
          name="email"
          autocomplete="email"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="send"
          maxlength="254"
          required
          :disabled="!gereed"
          :aria-invalid="emailFout ? 'true' : 'false'"
          :aria-describedby="emailFout ? `bladmuziek-email-fout ${uitlegId}` : uitlegId"
        />
      </FormulierVeld>

      <!-- Verborgen veld tegen spam: niet zichtbaar, niet in de tabvolgorde, niet voorgelezen -->
      <div class="val" aria-hidden="true">
        <label for="bladmuziek-website"
          >Website
          <input
            id="bladmuziek-website"
            ref="valVeld"
            v-model="website"
            type="text"
            name="website"
            tabindex="-1"
            autocomplete="off"
            :disabled="!gereed"
          />
        </label>
      </div>

      <div class="vakje">
        <label for="bladmuziek-nieuwsbrief" class="vakje__rij">
          <input
            id="bladmuziek-nieuwsbrief"
            v-model="nieuwsbrief"
            class="vakje__invoer"
            type="checkbox"
            name="nieuwsbrief"
            :disabled="!gereed"
            :aria-label="T.nieuwsbriefAria"
          />
          <span>{{ T.nieuwsbrief }}</span>
        </label>
        <p class="vakje__uitleg">{{ T.nieuwsbriefUitleg }}</p>
      </div>

      <!-- Hier zet Cloudflare het controlevak neer, alleen als het een controle vraagt -->
      <div ref="widgetPlek" :class="['widget', controleOpen && 'widget--open']" />

      <div role="alert" class="houder">
        <FormulierMelding v-if="melding" soort="fout">
          <p v-if="melding === 'teVaak'">{{ F.teVaak }}</p>
          <p v-else-if="melding === 'druk'">
            {{ F.druk }}<a :href="`mailto:${MAIL}`">{{ MAIL }}</a
            >{{ F.drukNa }}
          </p>
          <p v-else>
            {{ F.mis }}<a :href="`mailto:${MAIL}`">{{ MAIL }}</a
            >{{ F.misNa }}
          </p>
        </FormulierMelding>
      </div>

      <button
        type="submit"
        class="knop kaart__knop"
        :disabled="!gereed"
        :aria-disabled="bezig ? 'true' : undefined"
        :aria-label="bezig ? undefined : `${T.knop} van ${titel}`"
      >
        <template v-if="bezig">
          <span class="knop__rondje" aria-hidden="true" />{{ T.knopBezig }}
        </template>
        <template v-else>{{ T.knop }}</template>
      </button>

      <p :id="uitlegId" class="kaart__uitleg">
        {{ T.uitlegVoor }}<NuxtLink to="/privacy/">{{ T.uitlegLink }}</NuxtLink
        >{{ T.uitlegNa }}
      </p>
    </form>
  </section>
</template>

<style scoped>
.bladmuziek {
  scroll-margin-block-start: 2rem;
}

/* De crème kaart: 600 px breed (de tekstkolom), binnenruimte 40 px, op mobiel 24 / 20 */
.kaart {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem 1.25rem;
  border-radius: 1rem;
  background: var(--kleur-creme);
}

@media (min-width: 48rem) {
  .kaart {
    padding: 2.5rem;
  }
}

.kaart__regel,
.kaart__uitleg {
  margin: 0;
}

.kaart__uitleg {
  font-size: var(--tekst-klein);
  line-height: 1.5;
}

.kaart__uitleg a {
  color: var(--link);
  text-underline-offset: 0.15em;
}

/* Het verborgen veld tegen spam */
.val {
  position: absolute;
  inset-inline-start: -10000px;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
}

/* Het vakje: de hele rij is aan te tikken (44 px hoog), het vakje zelf is 24 px */
.vakje__rij {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  min-block-size: var(--doel-min);
  cursor: pointer;
}

.vakje__invoer {
  flex: none;
  inline-size: 1.5rem;
  block-size: 1.5rem;
  margin: 0;
  accent-color: var(--kleur-terracotta-diep);
}

.vakje__uitleg {
  margin: 0.25rem 0 0;
  padding-inline-start: 2.25rem;
  font-size: var(--tekst-klein);
  line-height: 1.5;
}

/* De uitleg bij een formulier dat niet laadt: onzichtbaar en zonder ruimte, en na 6 seconden zichtbaar (alleen als de
   pagina dan nog niet is geladen). Zonder JavaScript staat de noscript-regel er al; dan blijft deze regel weg. */
.zonder-script {
  margin-block-end: -1.25rem;
  block-size: 0;
  overflow: hidden;
  visibility: hidden;
  animation: toon-uitleg 0.01s 6s forwards;
}

@keyframes toon-uitleg {
  to {
    margin-block-end: 0;
    block-size: auto;
    overflow: visible;
    visibility: visible;
  }
}

@media (scripting: none) {
  .zonder-script {
    display: none;
  }
}

/* De melding-houder is er altijd (voor schermlezers) maar neemt geen ruimte als hij leeg is */
.houder:not(:has(.melding)) {
  margin-block-end: -1.25rem;
}

/* Alleen ruimte als Cloudflare een controlevak neerzet: zonder controlevak neemt het geen plaats in
   (de 20 px tussen de onderdelen valt dan weg) */
.widget:not(.widget--open) {
  margin-block-end: -1.25rem;
}

/* De knop is op mobiel zo breed als de kaart */
.kaart__knop {
  inline-size: 100%;
  padding-inline: 1rem;
  border: 0;
  font: inherit;
  cursor: pointer;
}

.kaart__knop[aria-disabled='true'] {
  cursor: progress;
}

@media (min-width: 48rem) {
  .kaart__knop {
    align-self: flex-start;
    inline-size: auto;
    padding-inline: 1.875rem;
  }
}

.knop__rondje {
  inline-size: 1.25rem;
  block-size: 1.25rem;
  margin-inline-end: 0.75rem;
  border: 3px solid rgb(255 255 255 / 0.4);
  border-block-start-color: var(--kleur-wit);
  border-radius: 50%;
  animation: draai 0.9s linear infinite;
}

@keyframes draai {
  to {
    transform: rotate(360deg);
  }
}

/* Voor wie minder beweging wil: het rondje staat stil, de tekst zegt genoeg */
@media (prefers-reduced-motion: reduce) {
  .knop__rondje {
    animation: none;
  }
}
</style>
