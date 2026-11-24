// "4:21" wordt "PT4M21S", de vorm die schema.org voor een duur vraagt.
export function isoDuur(duur: string): string {
  const [minuten, seconden] = duur.split(':').map(Number)
  return `PT${minuten}M${seconden}S`
}
