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

// De naam van de bezoeker voor in de aanhef 'Dag <naam>,'. Iedereen kan op een formulier elk adres en elke naam invullen,
// dus de mail aan dat adres bevat alleen een 'gewone' naam: uitsluitend letters (ook met accenten, alle Unicode-letters),
// spaties, een koppelteken en een apostrof, na het trimmen en het samenvoegen van dubbele spaties maximaal 40 tekens.
// Alles anders (een adres, een link, haakjes, cijfers, regeleinden, te lang, leeg) geeft null: dan staat er 'Dag,'.
// Besluit van de eigenaar, 2026-11-24.
const GEWONE_NAAM = /^[\p{L}\p{M}][\p{L}\p{M} '’-]*$/u
// `max` is het maximum aantal tekens: 40 voor de aanhef in een mail, 60 voor een voor- of achternaam bij Brevo en 80
// voor een volledige naam bij Brevo (worker/brevo.mjs). Een naam die er niet door komt geeft null en wordt dan gewoon
// weggelaten: het weigert nooit een aanvraag of aanmelding.
export function veiligeNaam(naam, max = 40) {
  const schoon = String(naam ?? '')
    .trim()
    .replace(/ {2,}/g, ' ')
  if ([...schoon].length > max || !GEWONE_NAAM.test(schoon) || !/\p{L}/u.test(schoon)) return null
  return schoon
}

export function mailBezoeker({ naam, titel, nieuwsbrief }) {
  const extra = nieuwsbrief && NIEUWSBRIEF_ALINEA ? NIEUWSBRIEF_ALINEA : null
  const alineas = [
    veiligeNaam(naam) ? `Dag ${veiligeNaam(naam)},` : 'Dag,',
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

// Een stukje van de bezoeker voor in een onderwerpregel: zonder regeleinden en stuurtekens, afgekapt
const kort = (tekst, max) => [...regel(tekst)].slice(0, max).join('')

// De mail aan Mariëlle. Alles wat de bezoeker intikt komt hier terecht (platte tekst en veilig gemaakte HTML); het
// antwoord gaat via reply_to naar de bezoeker. Onderwerp: een vast voorvoegsel, het onderwerp uit de vaste lijst en
// de naam (één regel, maximaal 60 tekens): 'Contactformulier: Boeking (Naam)'.
export function mailContactMarielle({ naam, email, onderwerp, bericht, boeking }) {
  const b = boeking ?? {}
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
    subject: `Contactformulier: ${ONDERWERPEN[onderwerp]} (${kort(naam, 60)})`,
    text: regels.join('\n'),
    html: regels
      .map((r) => (r === '' ? '<br>' : `<p>${html(r).replace(/\n/g, '<br>')}</p>`))
      .join('\n'),
  }
}

// De bevestiging aan de bezoeker: ALLEEN vaste tekst. Niets van wat de bezoeker intikte (geen naam, geen bericht,
// geen samenvatting, geen link) staat erin, zodat het formulier niet kan worden gebruikt om met onze afzender een
// eigen tekst naar iemand anders te sturen (besluit, 2026-11-24). De vaste regel 'Heb jij dit bericht niet verstuurd?'
// helpt iemand wiens adres is gebruikt (besluit van de Manager). Geen belofte over een reactietermijn.
export function mailContactBevestiging() {
  const alineas = [
    'Dag,',
    'Dank je voor je bericht. Het is bij mij aangekomen, en ik reageer zo snel ik kan.',
    'Heb jij dit bericht niet verstuurd? Dan hoef je niets te doen.',
    'Liefs,',
    'Mariëlle Madern',
  ]
  return {
    subject: 'Je bericht aan Mariëlle Madern is binnengekomen',
    text: alineas.join('\n\n'),
    html: alineas.map((a) => `<p>${html(a)}</p>`).join('\n'),
  }
}
