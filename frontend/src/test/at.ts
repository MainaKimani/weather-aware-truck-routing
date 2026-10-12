/** Indexing and null checks that fail the test with a clear message, instead of `!`. */
export function at<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined)
    throw new Error(`no item at index ${String(index)} (length ${String(items.length)})`)
  return item
}

export function required<T>(value: T | null | undefined, what = 'value'): T {
  if (value === null || value === undefined) throw new Error(`expected a ${what}`)
  return value
}
