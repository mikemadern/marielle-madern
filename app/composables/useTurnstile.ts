// Cloudflare Turnstile voor een formulier: het script en het controlevak laden pas als het formulier wordt gebruikt
// (focus in het formulier of een klik op de koppeling erheen), zoals de YouTube-speler pas na een klik laadt. De
// `actie` (data-action) hoort bij de controle in de Worker: elk formulier heeft zijn eigen actie.
import type { Ref } from 'vue'

interface TurnstileApi {
  render: (el: HTMLElement, opties: Record<string, unknown>) => string
  reset: (id?: string) => void
  remove: (id?: string) => void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

// Het script wordt één keer geladen, ook als er meer dan één formulier is
let scriptBelofte: Promise<TurnstileApi> | null = null

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

export function useTurnstile({ actie, plek }: { actie: string; plek: Ref<HTMLElement | null> }) {
  const sitekey = useRuntimeConfig().public.turnstileSitekey
  // True zolang Cloudflare een zichtbaar controlevak toont (dan telt de ruimte ervan mee)
  const controleOpen = ref(false)
  let widgetId: string | undefined
  let token = ''
  let wachtenden: { ok: (t: string) => void; mis: () => void }[] = []

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
    if (!sitekey || widgetId !== undefined || !plek.value) return
    widgetId = '' // meteen bezet, zodat een tweede aanroep niet nog een widget maakt
    try {
      const turnstile = await laadScript()
      widgetId = turnstile.render(plek.value!, {
        sitekey,
        action: actie,
        appearance: 'interaction-only',
        // Het zichtbare controlevak is 300 px breed; past dat niet in de kaart (smalle telefoon), dan het compacte
        // formaat (150 px) in plaats van het te vervormen of te laten uitsteken
        size: plek.value.clientWidth < 300 ? 'compact' : 'normal',
        language: 'nl',
        'before-interactive-callback': () => (controleOpen.value = true),
        'after-interactive-callback': () => (controleOpen.value = false),
        callback: (t: string) => {
          controleOpen.value = false
          tokenOntvangen(t)
        },
        'expired-callback': () => (token = ''),
        'error-callback': tokenMislukt,
        'timeout-callback': () => (token = ''),
      })
    } catch {
      widgetId = undefined
      tokenMislukt()
    }
  }

  // Geeft het token, of wacht erop (maximaal 20 seconden)
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

  // Het formulier verdwijnt (gelukt): ook het controlevak van Cloudflare opruimen
  function ruimOp() {
    if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    widgetId = undefined
  }

  return { controleOpen, laad, krijgToken, nieuwToken, ruimOp }
}
