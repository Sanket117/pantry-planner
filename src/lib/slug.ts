export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function uniqueSlug(base: string, exists: (id: string) => Promise<boolean>): Promise<string> {
  const root = slugify(base) || 'item'
  let candidate = root
  let n = 2
  while (await exists(candidate)) {
    candidate = `${root}-${n}`
    n += 1
  }
  return candidate
}
