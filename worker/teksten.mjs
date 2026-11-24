// De teksten van de twee mails (design/teksten-bladmuziek.md, Tekstschrijver). Alleen vaste tekst en de
// ingevulde titel en naam; alles wat een bezoeker intikt wordt hier voor HTML veilig gemaakt.

export const AFZENDER = 'Mariëlle Madern <hallo@mariellemadern.nl>'
export const ADRES_MARIELLE = 'hallo@mariellemadern.nl'

// Extra alinea in de mail aan de bezoeker die de nieuwsbrief heeft aangevinkt. De tekst staat nog bij "te
// bevestigen door Mariëlle" (wanneer en hoe de eerste nieuwsbrief komt), dus nu geen alinea: null.
export const NIEUWSBRIEF_ALINEA = null

const html = (tekst) =>
  String(tekst).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

// Een regel zonder regeleinden, voor onderwerpen en voor de platte tekst
const regel = (tekst) =>
  String(tekst)
    .replace(/[\p{Zl}\p{Zp}\r\n]+/gu, ' ')
    .trim()

export function mailBezoeker({ naam, titel, nieuwsbrief }) {
  const extra = nieuwsbrief && NIEUWSBRIEF_ALINEA ? NIEUWSBRIEF_ALINEA : null
  const alineas = [
    `Dag ${regel(naam)},`,
    `Fijn dat je de bladmuziek van ${titel} wilt hebben. Je vindt hem in de bijlage.`,
    'Ik hoop dat het nummer je iets brengt, wanneer je het speelt of zingt.',
    ...(extra ? [extra] : []),
    'Liefs,',
    'Mariëlle Madern',
  ]
  return {
    subject: `De bladmuziek van ${titel}`,
    text: alineas.join('\n\n'),
    html: alineas.map((a) => `<p>${html(a)}</p>`).join('\n'),
  }
}

export function mailMarielle({ naam, email, titel, nieuwsbrief }) {
  return {
    subject: `Bladmuziek aangevraagd: ${titel}`,
    text: [
      'Aanvraag bladmuziek.',
      '',
      `Nummer: ${titel}`,
      `Naam: ${regel(naam)}`,
      `E-mailadres: ${email}`,
      `Nieuwsbrief aangevinkt: ${nieuwsbrief ? 'ja' : 'nee'}`,
      '',
      'De bladmuziek is naar het e-mailadres gestuurd.',
    ].join('\n'),
  }
}

// ---------- Contactformulier ----------
// De teksten van de Tekstschrijver (design/teksten-contactformulier.md, 2026-11-24). De sleutels van het onderwerp en
// de velden zijn vast; de labels komen uit het ontwerp.
export const ONDERWERPEN = {
  vraag: 'Algemene vraag',
  boeking: 'Boeking',
}

// De velden die alleen bij een boeking horen (alle zes optioneel, gewone tekstvelden)
export const BOEKINGSVELDEN = {
  datumtijd: 'Datum en tijd',
  plaats: 'Plaats',
  gelegenheid: 'Soort gelegenheid',
  aantal: 'Verwacht aantal bezoekers',
  speeltijden: 'Speeltijden en duur',
  budget: 'Budget',
}

// Wat staat er in de bevestigingsmail aan de bezoeker?
//   false (standaard, de veilige keuze): ALLEEN vaste tekst, plus het onderwerp uit de vaste lijst. Niets van wat de
//     bezoeker intikte (geen naam, geen bericht, geen link): het formulier kan dan niet worden gebruikt om met onze
//     afzender een eigen tekst naar iemand anders te sturen.
//   true (zoals de Tekstschrijver het schreef): met de naam, de gegevens van de boeking en het bericht van de bezoeker
//     erin, zodat de bezoeker kan controleren wat er is aangekomen. Dat maakt misbruik mogelijk (iemand vult een ander
//     adres in en zet een eigen tekst in het bericht); de beperkingen zijn dan alleen Turnstile en de limieten.
// Een besluit van de eigenaar; zie de PR-tekst.
export const BEVESTIGING_MET_GEGEVENS = false

// Een stukje van de bezoeker voor in een onderwerpregel: zonder regeleinden en stuurtekens, afgekapt
const kort = (tekst, max) => [...regel(tekst)].slice(0, max).join('')

// De mail aan Mariëlle. Alles wat de bezoeker intikt komt hier terecht (platte tekst en veilig gemaakte HTML); het
// antwoord gaat via reply_to naar de bezoeker. Onderwerp: 'Boeking: [plaats of datum] van [naam]' of 'Vraag van
// [naam]'.
export function mailContactMarielle({ naam, email, onderwerp, bericht, boeking }) {
  const b = boeking ?? {}
  const kopje =
    onderwerp === 'boeking'
      ? `Boeking: ${kort(b.plaats || b.datumtijd || 'zonder plaats of datum', 60)} van ${kort(naam, 60)}`
      : `Vraag van ${kort(naam, 60)}`
  const velden =
    onderwerp === 'boeking'
      ? Object.entries(BOEKINGSVELDEN).map(([k, label]) =>
          `${label}: ${regel(b[k] ?? '')}`.trimEnd(),
        )
      : []
  const regels = [
    `Onderwerp: ${ONDERWERPEN[onderwerp]}`,
    `Naam: ${regel(naam)}`,
    `E-mailadres: ${email}`,
    ...(velden.length ? ['', ...velden] : []),
    '',
    'Bericht:',
    bericht,
  ]
  return {
    subject: kopje,
    text: regels.join('\n'),
    html: regels
      .map((r) => (r === '' ? '<br>' : `<p>${html(r).replace(/\n/g, '<br>')}</p>`))
      .join('\n'),
  }
}

// De bevestiging aan de bezoeker (zie BEVESTIGING_MET_GEGEVENS). Geen belofte over een reactietermijn.
export function mailContactBevestiging(
  { naam, onderwerp, bericht, boeking },
  gegevens = BEVESTIGING_MET_GEGEVENS,
) {
  const b = boeking ?? {}
  const samenvatting = [
    `Onderwerp: ${ONDERWERPEN[onderwerp]}`,
    ...(gegevens && onderwerp === 'boeking'
      ? Object.entries(BOEKINGSVELDEN)
          .filter(([k]) => regel(b[k] ?? '') !== '')
          .map(([k, label]) => `${label}: ${regel(b[k])}`)
      : []),
    ...(gegevens ? [`Je bericht: ${bericht}`] : []),
  ]
  const alineas = [
    gegevens ? `Dag ${regel(naam)},` : 'Dag,',
    'Dank je voor je bericht. Het is bij mij aangekomen, en ik reageer zo snel ik kan.',
    ...(gegevens ? ['Dit heb je gestuurd:'] : []),
    samenvatting.join('\n'),
    ...(gegevens ? [] : ['Heb jij dit bericht niet verstuurd? Dan hoef je niets te doen.']),
    'Hartelijke groet,',
    'Mariëlle Madern',
  ]
  return {
    subject: 'Ik heb je bericht ontvangen',
    text: alineas.join('\n\n'),
    html: alineas.map((a) => `<p>${html(a).replace(/\n/g, '<br>')}</p>`).join('\n'),
  }
}
