// De volgorde van de nummers zoals op Over de muziek: eerst de EP in de volgorde van de cd (content/uitgaven),
// daarna de singles, de nieuwste (hoogste volgorde) eerst.
interface NummerVolgorde {
  path: string
  uitgave: string
  volgorde: number
}

export function nummerVolgorde<T extends NummerVolgorde>(nummers: T[], epNummers: string[]): T[] {
  const ep = epNummers.flatMap((slug) => {
    const n = nummers.find((x) => x.path.endsWith(`/${slug}`))
    return n ? [n] : []
  })
  const singles = nummers
    .filter((n) => n.uitgave === 'single')
    .sort((a, b) => b.volgorde - a.volgorde)
  return [...ep, ...singles]
}
