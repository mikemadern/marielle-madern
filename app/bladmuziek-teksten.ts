// De teksten van het bladmuziekformulier (design/teksten-bladmuziek.md, Tekstschrijver; 'Bezig met versturen' van
// de Designer). Alle vaste tekst staat hier, zodat een wijziging op één plek kan.
export const MAIL = 'hallo@mariellemadern.nl'

export const TEKSTEN = {
  kop: 'Bladmuziek van dit nummer',
  koppeling: 'Bladmuziek van dit nummer',
  regel:
    'Vul je naam en e-mailadres in, dan stuur ik de bladmuziek van dit nummer naar je toe. Dat is gratis.',
  naam: 'Naam',
  email: 'E-mailadres',
  nieuwsbrief: 'Ik wil de nieuwsbrief ontvangen.',
  nieuwsbriefAria: 'Ik wil de nieuwsbrief ontvangen (optioneel)',
  // TE BEVESTIGEN door Mariëlle (hoe vaak de nieuwsbrief verschijnt en wat erin staat): alleen de eerste zin van
  // de Tekstschrijver staat hier, de rest van de uitleg ontbreekt tot het besluit er is.
  nieuwsbriefUitleg: 'Met de nieuwsbrief hou ik je op de hoogte van nieuwe muziek en activiteiten.',
  knop: 'Stuur mij de bladmuziek',
  knopBezig: 'Bezig met versturen',
  uitlegVoor:
    'Ik vraag je e-mailadres alleen om de bladmuziek naar je te sturen. Je adres gebruik ik voor niets anders. Lees hoe ik met je gegevens omga in de ',
  uitlegLink: 'privacyverklaring',
  uitlegNa: '.',
  fouten: {
    naamLeeg: 'Vul je naam in.',
    emailLeeg: 'Vul je e-mailadres in.',
    emailOngeldig:
      'Dit e-mailadres lijkt niet te kloppen. Controleer het, dan probeer je het nog eens.',
    teVaak: 'Even geduld: probeer het over een minuutje nog eens.',
    druk: 'Het versturen lukt nu even niet. Probeer het later nog eens, of mail me op ',
    drukNa: '.',
    mis: 'Er ging iets mis bij het versturen. Probeer het nog eens, of mail ',
    misNa: ' en vermeld het nummer waar je de bladmuziek voor wilde.',
  },
  bevestigingKop: 'Dank je wel.',
  bevestiging:
    'De bladmuziek is naar je e-mailadres verstuurd. Kijk ook in je spam of ongewenste mail als hij niet in je postvak staat.',
} as const
