import { defineProvider } from '@nuxt/image/runtime'

// Verwijst naar de bestanden die scripts/afbeeldingen.mjs maakt, met gewone bestandsnamen:
// /covers/hart-van-glas.webp, breedte 384 wordt /afbeeldingen/covers/hart-van-glas-384.webp.
// De breedtes moeten kloppen met scripts/afbeeldingen.mjs.
const BREEDTES = [300, 384, 600, 768, 1280]

export default defineProvider({
  getImage(src, { modifiers }) {
    const gevraagd = Number(modifiers?.width) || BREEDTES[BREEDTES.length - 1]!
    const breedte = BREEDTES.find((b) => b >= gevraagd) ?? BREEDTES[BREEDTES.length - 1]!
    const zonderExtensie = src.replace(/^\//, '').replace(/\.[^./]+$/, '')
    return { url: `/afbeeldingen/${zonderExtensie}-${breedte}.webp` }
  },
})
