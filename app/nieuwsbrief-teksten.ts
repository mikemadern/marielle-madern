// De teksten van het aanmeldformulier voor de nieuwsbrief in de voet (design/teksten-nieuwsbrief.md, sectie 1 en 1b,
// Tekstschrijver; ontwerp in design/nieuwsbrief-aanmelden.md). Alle vaste tekst staat hier, zodat een wijziging op één plek kan.
import { MAIL } from '~/bladmuziek-teksten'

export { MAIL }

// (De kop en de regel van de strook staan in SiteVoet.vue: de voet staat op elke pagina en mag deze code niet meetrekken.)
export const TEKSTEN = {
  voornaam: 'Voornaam',
  achternaam: 'Achternaam',
  optioneel: 'optioneel',
  email: 'E-mailadres',
  knop: 'Meld me aan',
  knopBezig: 'Bezig met aanmelden',
  uitlegVoor:
    'Zo kan ik je persoonlijk aanspreken. Afmelden kan altijd. Lees hoe ik met je gegevens omga in de ',
  uitlegLink: 'privacyverklaring',
  uitlegNa: '.',
  // Zichtbaar zonder JavaScript of als het script niet laadt
  zonderScript: `Aanmelden heeft JavaScript nodig. Zonder JavaScript kun je mailen naar ${MAIL}.`,
  fouten: {
    emailLeeg: 'Vul je e-mailadres in.',
    emailOngeldig:
      'Dit e-mailadres lijkt niet te kloppen. Controleer het, dan probeer je het nog eens.',
    teVaak: 'Even geduld: probeer het over een minuutje nog eens.',
    // Drukte of uitgeschakeld (503, site-breed): sectie 1, rij 'Drukte' (aangepast naar aanmelden)
    druk: 'Het aanmelden lukt nu even niet. Probeer het later nog eens, of mail me op ',
    drukNa: '.',
    mis: 'Er ging iets mis bij het aanmelden. Probeer het nog eens, of mail ',
    misNa: '.',
  },
  bevestigingKop: 'Dank je wel.',
  bevestiging:
    'Je bent aangemeld voor de nieuwsbrief. Je kunt je altijd weer afmelden via de link onderaan elke nieuwsbrief.',
  // Alleen bij een antwoord met later:true (Brevo is even niet bereikbaar, de aanmelding wordt tot 24 uur herhaald):
  // sectie 1c van design/teksten-nieuwsbrief.md. De gewone aanmelding houdt de Gelukt-tekst hierboven.
  bevestigingLater:
    'Je aanmelding is binnen. In elke nieuwsbrief staat een link om je af te melden.',
} as const
