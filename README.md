# Website Mariëlle Madern

Broncode van [mariellemadern.nl](https://mariellemadern.nl). Gebouwd met Nuxt (Vue), Nuxt Content, Nuxt SEO en Nuxt Image. De site wordt bij het bouwen helemaal vooraf gemaakt en als statische bestanden uitgerold op Cloudflare Workers. Er draait geen server en geen database.

Het plan, de besluiten en de huisstijl staan in de map `documenten/` naast deze map, niet in deze repository.

## Aan de slag

Je hebt Node 22.5 of nieuwer nodig (Node 24 wordt gebruikt) en pnpm.

```bash
pnpm install
```

| Opdracht          | Wat het doet                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `pnpm dev`        | Ontwikkelserver op http://localhost:3000                                                          |
| `pnpm generate`   | Bouwt de hele site naar `.output/public`                                                          |
| `pnpm preview`    | Draait het resultaat van `pnpm generate` lokaal in de Cloudflare-omgeving (http://localhost:8787) |
| `pnpm run deploy` | Bouwt en rolt uit naar Cloudflare (eerst `pnpm exec wrangler login`)                              |
| `pnpm controle`   | Controleert alle inhoud in `content/` (draait ook bij `pnpm generate`)                            |
| `pnpm lettertype` | Maakt de WOFF2-subset van Atlantis opnieuw (vraagt het bron-TTF als argument)                     |
| `pnpm lint`       | Controleert de code, inclusief toegankelijkheidsregels voor templates                             |
| `pnpm format`     | Zet de code in de afgesproken opmaak                                                              |
| `pnpm typecheck`  | Controleert de types                                                                              |

Let op: gebruik `pnpm run deploy`. Zonder `run` start pnpm zijn eigen, ingebouwde commando `deploy` (voor workspaces) en niet ons script.

## Indeling

```
app/                  pagina's, componenten en stijl
  assets/css/         tokens.css (huisstijl) en basis.css
  bronafbeeldingen/   originele afbeeldingen (worden niet uitgerold)
  providers/          eigen afbeeldingsprovider voor Nuxt Image
content/              alle inhoud als Markdown
  nummers/            een bestand per nummer: /over-de-muziek/{bestandsnaam}/
  paginas/            vaste pagina's: over-mij, contact, bestel-de-ep, privacy
public/               bestanden die ongewijzigd worden uitgerold
  _headers            beveiligings- en cacheheaders voor Cloudflare
  _redirects          redirects van de oude WordPress-site
  afbeeldingen/       wordt gemaakt door pnpm afbeeldingen (niet in git)
scripts/afbeeldingen.mjs   maakt de WebP-formaten van app/bronafbeeldingen
scripts/deelafbeeldingen.mjs  maakt de deelafbeeldingen (og:image, 1200 x 630) in public/afbeeldingen/og; welke hoezen erop mogen staat in scripts/deelafbeeldingen-toegestaan.json
scripts/controle-uitvoer.mjs  controleert de gebouwde pagina's (canonical, og- en twitter-tags, deelafbeeldingen, hero-poster), draait aan het eind van pnpm generate
content.config.ts     de velden van nummers en pagina's
wrangler.jsonc        Cloudflare-instellingen
```

## Lokaal bekijken zoals op Cloudflare

```bash
pnpm generate && pnpm preview
```

De site staat dan op http://localhost:8787 (bij `wrangler dev --port 8799` op 8799). Het handschrift boven de kop bekijk je met `?handschrift=boven` achter het adres.

## Werken met branches en uitrollen

Vanaf 2026-11-16 gaat elke wijziging via een branch en een pull request (PR) op GitHub. Zodra de repository in Cloudflare is gekoppeld (Workers Builds), bouwt en rolt Cloudflare automatisch uit:

- Een branch of PR krijgt een eigen preview (`wrangler preview`, vernoemd naar de branch). Het adres staat bij de check "Workers Builds" op de PR en in Cloudflare onder Previews. Dit adres is publiek.
- Cloudflare bouwt alleen branches die in deze repository staan. Een PR vanaf de fork van het bot-account (`studio-harmony`) krijgt daarom een preview via de workflow `.github/workflows/preview-bot-pr.yml`: die zet de PR, samengevoegd met de laatste `main`, als `preview/pr-<nummer>` in deze repository en plaatst het adres in een reactie op de PR. De branch verdwijnt als de PR sluit. Opnieuw zetten kan met de hand onder Actions, _Preview bot-PR_.
- Een samenvoeging in `main` rolt uit naar https://mariellemadern.mmadern.workers.dev, en na de livegang naar mariellemadern.nl.
- Handmatig uitrollen kan nog steeds met `pnpm run deploy`.

Instellingen in Cloudflare: branch `main`, bouwcommando `pnpm run build`, deploycommando `npx wrangler deploy`. De pnpm-versie staat vast in `package.json` (`packageManager`) en de Node-versie in `.node-version`, zodat Cloudflare hetzelfde gebruikt als wij.

## Een nummer toevoegen

1. Zet de cover (vierkant, bij voorkeur 1280 px) in `app/bronafbeeldingen/covers/` en het voorbeeldbeeld van de video (16:9, 1280 px breed) in `app/bronafbeeldingen/videos/`, beide als `.webp`, `.jpg` of `.png` met de bestandsnaam van het nummer.
2. Kopieer een bestaand bestand in `content/nummers/` en pas de velden aan. De velden staan in `content.config.ts`.
3. Zet titel en description **altijd tussen dubbele aanhalingstekens**. Een dubbele punt zonder aanhalingstekens breekt het kopblok.
4. Draai `pnpm controle` en controleer met `pnpm dev`. Voeg het nummer toe aan `videolijst` in `content/home.yml` als het op de homepage moet staan.
5. Geef elk nummer een `kaartregel`: één korte regel voor de kaart op de homepage. Is er een Apple Music-link naar het nummer zelf, zet die dan in `appleMusic` (volledige link). Zonder dat veld gaat de knop naar de artiestpagina. Het nummer in de grote speler bij het laden staat in `uitgelicht` in `content/home.yml` (moet in `videolijst` staan).

## Let op

- `public/afbeeldingen/` wordt gegenereerd uit `app/bronafbeeldingen/`. Pas daar niets handmatig aan.
- Het bestand `app/assets/css/tokens.css` is een kopie van `documenten/huisstijl/tokens.css`. Vanaf nu is de kopie in deze map leidend.
- Wachtwoorden en tokens komen nooit in deze repository. Cloudflare-toegang loopt via `wrangler login`.
