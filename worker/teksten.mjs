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
