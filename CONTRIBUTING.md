# Meewerken aan deze repository

Korte afspraken, zodat `main` altijd werkend en overzichtelijk blijft.

## Werkwijze

1. **Issue**: begin met een [issue](https://github.com/mikemadern/marielle-madern/issues/new/choose) (fout of wijziging) en geef het een **milestone**.
2. **Branch**: maak een branch vanaf `main`, bijvoorbeeld `fix/korte-omschrijving` of `feature/korte-omschrijving`. Direct pushen naar `main` kan niet.
3. **Pull request**: open een PR naar `main` en zet `Closes #<nummer>` in de beschrijving. Volg de checklist in het PR-template.
4. **Merge**: zodra de checks groen zijn en de PR is goedgekeurd. Alleen *rebase-merge* is ingesteld, en de branch wordt daarna automatisch verwijderd.

Een merge in `main` rolt de site automatisch uit naar de proefsite, via Workers Builds in Cloudflare (na de livegang naar mariellemadern.nl). Een PR vanaf een branch in deze repo krijgt van Cloudflare een eigen preview-adres. Een PR vanaf de fork van het bot-account krijgt die via de workflow *Preview bot-PR*: het adres staat in een reactie op de PR. Handmatig uitrollen kan met `pnpm run deploy` (zonder `run` start pnpm zijn eigen, ingebouwde commando), zie het [`README.md`](README.md).

## Milestones

Werk wordt per milestone gevolgd, zodat je per onderwerp de voortgang ziet.

- Geef het **issue** een milestone. De PR die het issue sluit neemt die **automatisch over** (taak `milestone`).
- Is er geen milestone, dan toont de PR een waarschuwing. Dat blokkeert het mergen niet; kies er dan zelf een in de zijbalk van de PR.
- Dependabot-PR's krijgen geen milestone.

## Een issue bij elke PR

Elke PR hoort **in principe** bij een issue. De check `linked-issue` controleert dit.

- Kleine klus zonder issue (typefout, onderhoud)? Zet dan het label **`geen-issue`** op de PR.
- Dependabot-PR's zijn vrijgesteld.

## Geen `Co-authored-by` in commits

Commits mogen geen `Co-authored-by`-regel bevatten. De check `no-coauthor` kijkt naar alle commits in de PR en kent geen uitzonderingen.

Bestaande commits die er al een hebben, blijven zoals ze zijn: `main` is beschermd en de geschiedenis wordt niet herschreven.

## Checks

Voordat een PR gemerged kan worden, moeten deze checks groen zijn:

| Check | Wat |
|---|---|
| `build` | `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck` en `pnpm build` |
| `linked-issue` | de PR is gekoppeld aan een issue (of heeft het label `geen-issue`) |
| `no-coauthor` | geen `Co-authored-by` in de commits |

De taak `milestone` hoort er niet bij: die waarschuwt alleen en is niet verplicht.

## Lokaal draaien

De Node-versie staat in `.node-version`. Deze repository gebruikt **pnpm**, niet npm.

```bash
pnpm install
pnpm dev         # ontwikkelserver op http://localhost:3000
pnpm lint        # controleert de code, inclusief toegankelijkheidsregels
pnpm typecheck   # controleert de types
pnpm build       # controleert de inhoud en bouwt de site, hetzelfde als de CI
```

Het plan, de besluiten en de huisstijl staan niet in deze repository, maar in de aparte documentenmap. Beveiligingsproblemen: zie [`SECURITY.md`](SECURITY.md).
