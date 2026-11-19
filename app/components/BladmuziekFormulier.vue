<script setup lang="ts">
// Het formulier om de bladmuziek van een nummer per e-mail te vragen (design/bladmuziek-formulier.md).
// Het verstuurt naar POST /api/bladmuziek (worker/bladmuziek.mjs). Er wordt niets in de browser bewaard:
// naam en adres staan alleen in de velden en in dat ene verzoek.
//
// Cloudflare Turnstile laadt pas als het formulier wordt gebruikt (focus in het formulier of een klik op de
// koppeling erheen), zoals de YouTube-speler pas na een klik laadt. De actie `bladmuziek` hoort bij de controle
// in de Worker.
import { MAIL, TEKSTEN } from '~/bladmuziek-teksten'

const props = defineProps<{ nummer: string; titel: string }>()

const sitekey = useRuntimeConfig().public.turnstileSitekey
const T = TEKSTEN
const F = TEKSTEN.fouten

type Fout = 'naamLeeg' | 'emailLeeg' | 'emailOngeldig'
type Melding = 'teVaak' | 'druk' | 'mis'

const naam = ref('')
const email = ref('')
const nieuwsbrief = ref(false)
const website = ref('') // verborgen veld tegen spam: een mens vult het niet in
const bezig = ref(false)
const klaar = ref(false)
const naamFout = ref<Fout | null>(null)
const emailFout = ref<Fout | null>(null)
const melding = ref<Melding | null>(null)

const naamVeld = ref<HTMLInputElement | null>(null)
const emailVeld = ref<HTMLInputElement | null>(null)
const bevestiging = ref<HTMLElement | null>(null)
const widgetPlek = ref<HTMLElement | null>(null)

const uitlegId = 'bladmuziek-uitleg'

// ---------- Turnstile ----------

interface TurnstileApi {
  render: (el: HTMLElement, opties: Record<string, unknown>) => string
  reset: (id?: string) => void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptBelofte: Promise<TurnstileApi> | null = null
let widgetId: string | undefined
let token = ''
let wachtenden: { ok: (t: string) => void; mis: () => void }[] = []

function laadScript(): Promise<TurnstileApi> {
  scriptBelofte ??= new Promise((ok, mis) => {
    if (window.turnstile) return ok(window.turnstile)
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => (window.turnstile ? ok(window.turnstile) : mis(new Error('geen turnstile')))
    s.onerror = () => {
      scriptBelofte = null // een volgende poging mag het opnieuw proberen
      mis(new Error('script'))
    }
    document.head.append(s)
  })
  return scriptBelofte
}

function tokenOntvangen(t: string) {
  token = t
  const lijst = wachtenden
  wachtenden = []
  lijst.forEach((w) => w.ok(t))
}

function tokenMislukt() {
  token = ''
  const lijst = wachtenden
  wachtenden = []
  lijst.forEach((w) => w.mis())
}

// Zet het widget neer (één keer). `interaction-only`: het is alleen zichtbaar als Cloudflare een controle vraagt.
async function laad() {
  if (!sitekey || widgetId !== undefined || !widgetPlek.value) return
  widgetId = '' // meteen bezet, zodat een tweede aanroep niet nog een widget maakt
  try {
    const turnstile = await laadScript()
    widgetId = turnstile.render(widgetPlek.value!, {
      sitekey,
      action: 'bladmuziek',
      appearance: 'interaction-only',
      language: 'nl',
      callback: tokenOntvangen,
      'expired-callback': () => (token = ''),
      'error-callback': tokenMislukt,
      'timeout-callback': () => (token = ''),
    })
  } catch {
    widgetId = undefined
    tokenMislukt()
  }
}

function krijgToken(): Promise<string> {
  if (token) return Promise.resolve(token)
  void laad()
  return new Promise((ok, mis) => {
    const wacht = { ok, mis }
    wachtenden.push(wacht)
    setTimeout(() => {
      if (wachtenden.includes(wacht)) {
        wachtenden = wachtenden.filter((w) => w !== wacht)
        mis(new Error('time-out'))
      }
    }, 20000)
  })
}

// Een token werkt één keer: na elk verzoek een nieuwe vragen
function nieuwToken() {
  token = ''
  if (widgetId && window.turnstile) window.turnstile.reset(widgetId)
}

// De koppeling bij de luisterbalk roept dit aan: laden, zodat het widget klaar is als het formulier in beeld is
defineExpose({ laad })

onMounted(() => {
  if (location.hash === '#bladmuziek') void laad()
})

// ---------- Versturen ----------

const EMAIL_REGEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

async function verstuur() {
  if (bezig.value) return
  melding.value = null
  if (!controleer()) return naarEersteFout()
  bezig.value = true
  try {
    let t: string
    try {
      t = await krijgToken()
    } catch {
      melding.value = 'mis'
      return
    }
    const res = await fetch('/api/bladmuziek', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        naam: naam.value,
        email: email.value,
        nieuwsbrief: nieuwsbrief.value,
        nummer: props.nummer,
        token: t,
        website: website.value,
      }),
    })
    nieuwToken()
    if (res.ok) {
      klaar.value = true
      await nextTick()
      bevestiging.value?.focus()
      return
    }
    let fout = ''
    let veld = ''
    try {
      const body = await res.json()
      fout = String(body?.fout ?? '')
      veld = String(body?.veld ?? '')
    } catch {
      // geen JSON: een algemene fout
    }
    if (res.status === 400 && fout === 'ongeldig' && veld === 'naam') {
      naamFout.value = 'naamLeeg'
      await naarEersteFout()
    } else if (res.status === 400 && fout === 'ongeldig' && veld === 'email') {
      emailFout.value = 'emailOngeldig'
      await naarEersteFout()
    } else if (res.status === 429) {
      melding.value = 'teVaak'
    } else if (res.status === 503) {
      melding.value = 'druk'
    } else {
      melding.value = 'mis'
    }
  } catch {
    nieuwToken()
    melding.value = 'mis'
  } finally {
    bezig.value = false
  }
}
</script>

<template>
  <section id="bladmuziek" class="bladmuziek" aria-labelledby="bladmuziek-kop">
    <KopBlok :kop="T.kop" kop-id="bladmuziek-kop" />

    <div v-if="klaar" ref="bevestiging" class="melding melding--goed" role="status" tabindex="-1">
      <svg class="melding__icoon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="12" fill="currentColor" />
        <path
          d="M6.8 12.4l3.6 3.6 6.8-7.2"
          fill="none"
          stroke="#fff"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <div>
        <p class="melding__kop">{{ T.bevestigingKop }}</p>
        <p>{{ T.bevestiging }}</p>
      </div>
    </div>

    <form v-else class="kaart" novalidate @submit.prevent="verstuur" @focusin="laad">
      <p class="kaart__regel">{{ T.regel }}</p>

      <div class="veld">
        <label for="bladmuziek-naam" class="veld__etiket">
          <span class="veld__label">{{ T.naam }}</span>
          <input
            id="bladmuziek-naam"
            ref="naamVeld"
            v-model="naam"
            class="veld__invoer"
            type="text"
            name="naam"
            autocomplete="name"
            maxlength="100"
            :aria-invalid="naamFout ? 'true' : undefined"
            :aria-describedby="naamFout ? 'bladmuziek-naam-fout' : undefined"
          />
        </label>
        <div id="bladmuziek-naam-fout" role="alert">
          <p v-if="naamFout" class="veld__fout">
            <svg class="melding__icoon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="12" cy="12" r="12" fill="currentColor" />
              <path d="M12 6.5v7" stroke="#fff" stroke-width="2.6" stroke-linecap="round" />
              <circle cx="12" cy="17.4" r="1.6" fill="#fff" />
            </svg>
            {{ F[naamFout] }}
          </p>
        </div>
      </div>

      <div class="veld">
        <label for="bladmuziek-email" class="veld__etiket">
          <span class="veld__label">{{ T.email }}</span>
          <input
            id="bladmuziek-email"
            ref="emailVeld"
            v-model="email"
            class="veld__invoer"
            type="email"
            name="email"
            autocomplete="email"
            maxlength="254"
            :aria-invalid="emailFout ? 'true' : undefined"
            :aria-describedby="emailFout ? `bladmuziek-email-fout ${uitlegId}` : uitlegId"
          />
        </label>
        <div id="bladmuziek-email-fout" role="alert">
          <p v-if="emailFout" class="veld__fout">
            <svg class="melding__icoon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="12" cy="12" r="12" fill="currentColor" />
              <path d="M12 6.5v7" stroke="#fff" stroke-width="2.6" stroke-linecap="round" />
              <circle cx="12" cy="17.4" r="1.6" fill="#fff" />
            </svg>
            {{ F[emailFout] }}
          </p>
        </div>
      </div>

      <!-- Verborgen veld tegen spam: niet zichtbaar, niet in de tabvolgorde, niet voorgelezen -->
      <div class="val" aria-hidden="true">
        <label for="bladmuziek-website"
          >Website
          <input
            id="bladmuziek-website"
            v-model="website"
            type="text"
            name="website"
            tabindex="-1"
            autocomplete="off"
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
          />
          <span
            >{{ T.nieuwsbrief }}<span class="verborgen">{{ T.nieuwsbriefOptioneel }}</span></span
          >
        </label>
        <p class="vakje__uitleg">{{ T.nieuwsbriefUitleg }}</p>
      </div>

      <!-- Hier zet Cloudflare het controlevak neer, alleen als het een controle vraagt -->
      <div ref="widgetPlek" class="widget" />

      <div role="alert">
        <div v-if="melding" class="melding melding--fout">
          <svg class="melding__icoon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="12" fill="currentColor" />
            <path d="M12 6.5v7" stroke="#fff" stroke-width="2.6" stroke-linecap="round" />
            <circle cx="12" cy="17.4" r="1.6" fill="#fff" />
          </svg>
          <p v-if="melding === 'teVaak'">{{ F.teVaak }}</p>
          <p v-else-if="melding === 'druk'">
            {{ F.druk }}<a :href="`mailto:${MAIL}`">{{ MAIL }}</a
            >{{ F.drukNa }}
          </p>
          <p v-else>
            {{ F.mis }}<a :href="`mailto:${MAIL}`">{{ MAIL }}</a
            >{{ F.misNa }}
          </p>
        </div>
      </div>

      <button
        type="submit"
        class="knop kaart__knop"
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

.kaart__uitleg a,
.melding a {
  color: var(--link);
  text-underline-offset: 0.15em;
}

.veld {
  display: flex;
  flex-direction: column;
}

.veld__etiket {
  display: flex;
  flex-direction: column;
}

/* 10 px tussen label en veld, zodat de focusring het label niet raakt */
.veld__label {
  margin-block-end: 0.625rem;
  font-weight: var(--gewicht-vet);
}

.veld__invoer {
  box-sizing: border-box;
  inline-size: 100%;
  min-block-size: 3.25rem;
  padding: 0 calc(1.25rem - 1px);
  border: 1px solid var(--kleur-tekst);
  border-radius: 1.5625rem;
  background: var(--kleur-wit);
  color: var(--tekst);
  font: inherit;
  font-size: 1.1875rem;
}

.veld__invoer[aria-invalid='true'] {
  border: 2px solid var(--kleur-fout);
  padding-inline: calc(1.25rem - 2px);
}

.veld__fout {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  margin: 0.5rem 0 0;
  color: var(--kleur-fout);
  font-size: var(--tekst-klein);
  font-weight: var(--gewicht-vet);
  line-height: 1.4;
}

.melding__icoon {
  flex: none;
  inline-size: 1.25rem;
  block-size: 1.25rem;
  margin-block-start: 0.1rem;
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

/* Alleen ruimte als Cloudflare een controlevak neerzet: zonder controlevak neemt het geen plaats in
   (de 20 px tussen de onderdelen valt dan weg) */
.widget:not(:has(iframe)) {
  margin-block-end: -1.25rem;
}

.melding {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 1rem 1.25rem;
  border-radius: 0.5rem;
  background: var(--kleur-wit);
}

.melding p {
  margin: 0;
}

.melding--fout {
  border: 1px solid var(--kleur-fout);
  border-inline-start-width: 6px;
  color: var(--tekst);
}

.melding--fout .melding__icoon {
  color: var(--kleur-fout);
}

.melding--goed {
  border: 2px solid var(--kleur-groen);
  padding: 1.5rem;
}

.melding--goed .melding__icoon {
  color: var(--kleur-groen);
  inline-size: 1.5rem;
  block-size: 1.5rem;
}

.melding--goed:focus {
  outline: none;
}

.melding--goed:focus-visible {
  outline: var(--focus-breedte) solid var(--focus-kleur);
  outline-offset: var(--focus-afstand);
}

.melding__kop {
  font-weight: var(--gewicht-vet);
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
