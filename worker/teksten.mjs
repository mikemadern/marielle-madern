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
// VOORLOPIGE teksten: de Tekstschrijver levert de definitieve. De waarden van de onderwerpen (sleutels) zijn vast;
// alleen de labels kunnen nog veranderen.
export const ONDERWERPEN = {
  vraag: 'Algemene vraag',
  boeking: 'Boeking',
  samenwerking: 'Samenwerking',
  anders: 'Anders',
}

// Labels van de velden die alleen bij een boeking horen (allemaal optioneel)
export const BOEKINGSVELDEN = {
  datum: 'Datum',
  tijd: 'Tijd',
  plaats: 'Plaats',
  gelegenheid: 'Soort gelegenheid',
  aantal: 'Verwacht aantal bezoekers',
  speeltijden: 'Speeltijden en duur',
  budget: 'Budget',
}

// De mail aan Mariëlle. Alles wat de bezoeker intikt komt hier terecht (platte tekst en veilig gemaakte HTML); het
// antwoord gaat via reply_to naar de bezoeker. Het onderwerp heeft een vast voorvoegsel, het onderwerp uit de
// vaste lijst en de naam (maximaal 60 tekens, zonder regeleinden en stuurtekens).
export function mailContactMarielle({ naam, email, onderwerp, bericht, boeking }) {
  const kort = regel(naam).slice(0, 60)
  const velden = Object.entries(boeking ?? {}).map(([k, v]) => `${BOEKINGSVELDEN[k]}: ${regel(v)}`)
  const regels = [
    'Bericht via het contactformulier.',
    '',
    `Onderwerp: ${ONDERWERPEN[onderwerp]}`,
    `Naam: ${regel(naam)}`,
    `E-mailadres: ${email}`,
    ...(velden.length ? ['', ...velden] : []),
    '',
    'Bericht:',
    bericht,
  ]
  return {
    subject: `Contactformulier: ${ONDERWERPEN[onderwerp]} (${kort})`,
    text: regels.join('\n'),
    html: regels
      .map((r) => (r === '' ? '<br>' : `<p>${html(r).replace(/\n/g, '<br>')}</p>`))
      .join('\n'),
  }
}

// De bevestiging aan de bezoeker: ALLEEN vaste tekst. Niets van wat de bezoeker intikte (geen naam, geen bericht,
// geen link) staat erin, zodat het formulier niet kan worden gebruikt om iemand anders met onze afzender en een
// eigen tekst te mailen. Alleen het onderwerp uit de vaste lijst. Geen belofte over een reactietermijn.
export function mailContactBevestiging({ onderwerp }) {
  const alineas = [
    'Dag,',
    'Je bericht via de website van Mariëlle Madern is binnengekomen.',
    `Onderwerp: ${ONDERWERPEN[onderwerp]}`,
    'Heb jij dit bericht niet verstuurd? Dan hoef je niets te doen.',
    'Mariëlle Madern',
  ]
  return {
    subject: 'Je bericht aan Mariëlle Madern is binnengekomen',
    text: alineas.join('\n\n'),
    html: alineas.map((a) => `<p>${html(a)}</p>`).join('\n'),
  }
}
