<script setup lang="ts">
// Het aanmeldformulier voor de nieuwsbrief in de strook bovenin de voet, op elke pagina (design/nieuwsbrief-aanmelden.md).
// Het verstuurt naar POST /api/nieuwsbrief (worker/nieuwsbrief.mjs): alleen het e-mailadres is verplicht, voornaam en
// achternaam zijn optioneel. Er wordt niets in de browser bewaard.
//
// De voet laadt dit onderdeel pas als het in beeld komt (`hydrate-on-visible`) en zonder preload; Turnstile laadt pas als
// het formulier wordt gebruikt (focus in het formulier), met de actie `nieuwsbrief`. Dezelfde bouwstenen als de andere
// formulieren: `useTurnstile`, `useFormulierVerzending`, `FormulierVeld` en `FormulierMelding`.
import { MAIL, TEKSTEN } from '~/nieuwsbrief-teksten'

defineProps<{ labelledby?: string }>()

const T = TEKSTEN
const F = TEKSTEN.fouten

type Fout = 'emailLeeg' | 'emailOngeldig'

const voornaam = ref('')
const achternaam = ref('')
const email = ref('')
const website = ref('') // verborgen veld tegen spam: een mens vult het niet in
// Pas na het laden (hydratatie) kan het formulier worden gebruikt; tot dan staan de velden uit.
const gereed = ref(false)
const emailFout = ref<Fout | null>(null)

const emailVeld = ref<HTMLInputElement | null>(null)
const bevestiging = ref<HTMLElement | null>(null)
const widgetPlek = ref<HTMLElement | null>(null)
const valVeld = ref<HTMLInputElement | null>(null)

const { controleOpen, laad, krijgToken, nieuwToken, ruimOp } = useTurnstile({
  actie: 'nieuwsbrief',
  plek: widgetPlek,
})

onMounted(() => {
  gereed.value = true
})

const EMAIL_REGEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// De melding bij het adres verdwijnt zodra het adres klopt (niet bij elke toetsaanslag een nieuwe fout tonen)
watch(email, (v) => {
  if (emailFout.value && EMAIL_REGEL.test(v.trim())) emailFout.value = null
})

// Alleen het e-mailadres kan een fout geven: lege naamvelden nooit, ingevulde namen blijven staan
function controleer(): boolean {
  const e = email.value.trim()
  emailFout.value = !e ? 'emailLeeg' : EMAIL_REGEL.test(e) ? null : 'emailOngeldig'
  return !emailFout.value
}

async function naarEersteFout() {
  await nextTick()
  if (emailFout.value) emailVeld.value?.focus()
}

const { bezig, klaar, later, melding, verstuur } = useFormulierVerzending({
  pad: '/api/nieuwsbrief',
  turnstile: { krijgToken, nieuwToken, ruimOp },
  valVeld,
  website,
  bevestiging,
  valideer: controleer,
  naarEersteFout,
  body: (token, val) => ({
    voornaam: voornaam.value,
    achternaam: achternaam.value,
    email: email.value,
    token,
    website: val,
  }),
  // De server keurde het adres af (bijvoorbeeld door Brevo): de fout staat dan bij het adres. Namen worden nooit afgekeurd.
  serverVeldFout: (veld) => {
    if (veld !== 'email') return false
    emailFout.value = 'emailOngeldig'
    return true
  },
})
</script>

<template>
  <div v-if="klaar" class="nb">
    <FormulierMelding ref="bevestiging" soort="goed" role="status" tabindex="-1">
      <div>
        <p class="melding__kop">{{ T.bevestigingKop }}</p>
        <p>{{ later ? T.bevestigingLater : T.bevestiging }}</p>
      </div>
    </FormulierMelding>
  </div>

  <form
    v-else
    class="nb"
    method="post"
    action="/api/nieuwsbrief"
    novalidate
    :aria-labelledby="labelledby"
    @submit.prevent="verstuur"
    @focusin="laad"
  >
    <!-- Alleen tekst in noscript (geen elementen): anders klopt de hydratatie niet met wat de browser ziet -->
    <noscript class="nb__regel">{{ T.zonderScript }}</noscript>
    <!-- Laadt het script niet, dan staat er een formulier dat niets doet: na een paar seconden verschijnt dan dezelfde
         uitleg (alleen CSS, dus geen hydratatieverschil). Is de pagina geladen, dan verdwijnt deze regel. -->
    <p v-if="!gereed" class="nb__regel zonder-script">{{ T.zonderScript }}</p>

    <div class="nb__namen">
      <FormulierVeld
        id="nieuwsbrief-voornaam"
        fout-id="nieuwsbrief-voornaam-fout"
        :label="T.voornaam"
        :optioneel="T.optioneel"
      >
        <input
          id="nieuwsbrief-voornaam"
          v-model="voornaam"
          class="veld__invoer"
          type="text"
          name="voornaam"
          autocomplete="given-name"
          enterkeyhint="next"
          maxlength="60"
          :disabled="!gereed"
        />
      </FormulierVeld>
      <FormulierVeld
        id="nieuwsbrief-achternaam"
        fout-id="nieuwsbrief-achternaam-fout"
        :label="T.achternaam"
        :optioneel="T.optioneel"
      >
        <input
          id="nieuwsbrief-achternaam"
          v-model="achternaam"
          class="veld__invoer"
          type="text"
          name="achternaam"
          autocomplete="family-name"
          enterkeyhint="next"
          maxlength="60"
          :disabled="!gereed"
        />
      </FormulierVeld>
    </div>

    <FormulierVeld
      id="nieuwsbrief-email"
      fout-id="nieuwsbrief-email-fout"
      :label="T.email"
      :fout="emailFout ? F[emailFout] : null"
    >
      <input
        id="nieuwsbrief-email"
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
        :aria-describedby="
          emailFout ? 'nieuwsbrief-email-fout nieuwsbrief-uitleg' : 'nieuwsbrief-uitleg'
        "
      />
    </FormulierVeld>

    <!-- Verborgen veld tegen spam: niet zichtbaar, niet in de tabvolgorde, niet voorgelezen -->
    <div class="val" aria-hidden="true">
      <label for="nieuwsbrief-website"
        >Website
        <input
          id="nieuwsbrief-website"
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
      class="knop nb__knop"
      :disabled="!gereed"
      :aria-disabled="bezig ? 'true' : undefined"
    >
      <template v-if="bezig">
        <span class="knop__rondje" aria-hidden="true" />{{ T.knopBezig }}
      </template>
      <template v-else>{{ T.knop }}</template>
    </button>

    <p id="nieuwsbrief-uitleg" class="nb__uitleg">
      {{ T.uitlegVoor }}<NuxtLink to="/privacy/">{{ T.uitlegLink }}</NuxtLink
      >{{ T.uitlegNa }}
    </p>
  </form>
</template>
